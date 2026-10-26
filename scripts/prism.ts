import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { BastionError, main } from "./lib/errors.ts";
import { readConfig, readLock, type PakkuLock } from "./lib/lock.ts";
import { repoRoot } from "./lib/paths.ts";

const LAYOUT_DOCS = "docs/troubleshooting.md#prism-layout";
const LWJGL_VERSION = "3.3.3"; // required (suggested) by net.minecraft 1.21.1 in Prism's meta

export type LayoutResult = { ok: true; instanceDir: string } | { ok: false; reason: string };

/** The repo must live in `<Prism>/instances/<name>/minecraft` (or `.minecraft`). */
export function checkInstanceLayout(repoDir: string): LayoutResult {
    const fail = (): LayoutResult => ({
        ok: false,
        reason: `${repoDir} is not inside a Prism instance; clone into <Prism>/instances/<name>/minecraft`,
    });
    if (!["minecraft", ".minecraft"].includes(basename(repoDir))) return fail();
    const instanceDir = dirname(repoDir);
    if (existsSync(join(instanceDir, "instance.cfg"))) return { ok: true, instanceDir };
    // A fresh instance folder: only the game dir (and maybe Prism leftovers) exists, no instance.cfg yet.
    const parent = dirname(instanceDir);
    if (basename(parent) !== "instances" || parent === instanceDir) return fail();
    const entries = readdirSync(instanceDir).filter((n) => n !== basename(repoDir));
    const hasInstanceFiles = entries.some((n) => n === "mmc-pack.json" || n.endsWith(".cfg"));
    return hasInstanceFiles ? fail() : { ok: true, instanceDir };
}

export function renderMmcPack(lock: PakkuLock): object {
    const mc = lock.mc_versions[0];
    const neoforge = lock.loaders.neoforge;
    if (mc === undefined || neoforge === undefined) {
        throw new BastionError("pakku-lock.json has no Minecraft version or NeoForge loader", {
            hint: "this template targets NeoForge; re-run `pakku` init/set to restore the lock",
            docs: "docs/troubleshooting.md#prism-lock",
        });
    }
    return {
        components: [
            {
                cachedName: "LWJGL 3",
                cachedVersion: LWJGL_VERSION,
                cachedVolatile: true,
                dependencyOnly: true,
                uid: "org.lwjgl3",
                version: LWJGL_VERSION,
            },
            {
                cachedName: "Minecraft",
                cachedRequires: [{ suggests: LWJGL_VERSION, uid: "org.lwjgl3" }],
                cachedVersion: mc,
                important: true,
                uid: "net.minecraft",
                version: mc,
            },
            {
                cachedName: "NeoForge",
                cachedRequires: [{ equals: mc, uid: "net.minecraft" }],
                cachedVersion: neoforge,
                uid: "net.neoforged",
                version: neoforge,
            },
        ],
        formatVersion: 1,
    };
}

/**
 * Encodes a value the way Qt's QSettings writes INI strings, which is how Prism reads
 * instance.cfg: '\' and '"' are backslash-escaped, and values with ',', ';', '=' or edge
 * whitespace are wrapped in quotes. A bare '"' would start a quoted span instead.
 */
export function qtIniValue(value: string): string {
    const escaped = value.replace(/[\\"]/g, (c) => `\\${c}`);
    return /[,;=]|^\s|\s$/.test(value) ? `"${escaped}"` : escaped;
}

/**
 * Prism substitutes $INST_* before running. Absolute paths plus --working-path make the
 * command independent of Prism's working directory (Pakku otherwise searches cwd upward
 * for pakku.json).
 */
export function renderInstanceCfg(name: string): string {
    if (/[\r\n]/.test(name) || name.trim() === "") {
        throw new BastionError(`Invalid pack name for instance.cfg: ${JSON.stringify(name)}`, {
            hint: 'set a single-line "name" in pakku.json',
            docs: "docs/troubleshooting.md#prism-lock",
        });
    }
    return [
        "[General]",
        `name=${qtIniValue(name)}`,
        `PreLaunchCommand=${qtIniValue('"$INST_JAVA" -jar "$INST_MC_DIR/pakku.jar" --working-path "$INST_MC_DIR" fetch')}`,
        "ConfigVersion=1.2",
        "InstanceType=OneSix",
        "OverrideCommands=true",
        "",
    ].join("\n");
}

const MANAGED_KEYS = ["InstanceType", "OverrideCommands", "PreLaunchCommand"];

/** Line-level merge: replaces only the managed keys inside [General], keeps everything else. */
export function mergeInstanceCfg(existing: string, name: string): string {
    const managed = new Map<string, string>();
    for (const line of renderInstanceCfg(name).split("\n")) {
        const key = line.slice(0, line.indexOf("="));
        if (MANAGED_KEYS.includes(key)) managed.set(key, line);
    }
    const eol = existing.includes("\r\n") ? "\r\n" : "\n";
    const lines = existing.split(/\r?\n/);
    if (lines.at(-1) === "") lines.pop();
    let start = lines.findIndex((l) => l.trim() === "[General]");
    if (start === -1) {
        lines.unshift("[General]");
        start = 0;
    }
    let end = lines.findIndex((l, i) => i > start && /^\s*\[/.test(l));
    if (end === -1) end = lines.length;
    const seen = new Set<string>();
    const out: string[] = lines.slice(0, start + 1);
    for (const line of lines.slice(start + 1, end)) {
        const key = line.slice(0, Math.max(line.indexOf("="), 0));
        const repl = managed.get(key);
        if (repl === undefined) out.push(line);
        else if (!seen.has(key)) {
            seen.add(key);
            out.push(repl);
        } // duplicates of a managed key are dropped
    }
    for (const [key, line] of managed) if (!seen.has(key)) out.push(line);
    out.push(...lines.slice(end));
    return out.join(eol) + eol;
}

export function parseMode(arg: string | undefined): "setup" | "sync" {
    if (arg === "setup" || arg === "sync") return arg;
    throw new BastionError(`Unknown mode ${JSON.stringify(arg ?? "")}; valid modes: setup, sync`, {
        hint: "use `task setup:prism` or `task prism:sync`",
        docs: LAYOUT_DOCS,
    });
}

export function writeInstanceFiles(
    instanceDir: string,
    lock: PakkuLock,
    name: string,
    opts: { cfg: boolean },
): void {
    const pack = `${JSON.stringify(renderMmcPack(lock), null, 2)}\n`;
    const cfgPath = join(instanceDir, "instance.cfg");
    const cfg = !opts.cfg
        ? undefined
        : existsSync(cfgPath)
          ? mergeInstanceCfg(readFileSync(cfgPath, "utf8"), name)
          : renderInstanceCfg(name);
    writeFileSync(join(instanceDir, "mmc-pack.json"), pack);
    if (cfg !== undefined) writeFileSync(cfgPath, cfg);
}

/** True only when the instance's Minecraft and NeoForge versions equal the lock's. */
export function mmcPackMatches(instanceDir: string, lock: PakkuLock): boolean {
    try {
        const pack = JSON.parse(readFileSync(join(instanceDir, "mmc-pack.json"), "utf8")) as {
            components?: { uid?: string; version?: string }[];
        };
        const ver = (uid: string) => pack.components?.find((c) => c.uid === uid)?.version;
        const mc = lock.mc_versions[0];
        const nf = lock.loaders.neoforge;
        return (
            mc !== undefined &&
            nf !== undefined &&
            ver("net.minecraft") === mc &&
            ver("net.neoforged") === nf
        );
    } catch {
        return false;
    }
}

export function setupPrism(root: string, mode: "setup" | "sync"): string {
    const layout = checkInstanceLayout(root);
    if (!layout.ok) {
        throw new BastionError(layout.reason, {
            hint: "create an instance in Prism, then clone this repo into its minecraft folder (<Prism>/instances/<name>/minecraft)",
            docs: LAYOUT_DOCS,
        });
    }
    const lock = readLock(root);
    const name = mode === "setup" ? readConfig(root).name : "";
    writeInstanceFiles(layout.instanceDir, lock, name, { cfg: mode === "setup" });
    return layout.instanceDir;
}

if (import.meta.main) {
    await main(async () => {
        const mode = parseMode(process.argv[2]);
        console.log("Close Prism before running this: it rewrites instance.cfg on exit.");
        const dir = setupPrism(repoRoot(), mode);
        console.log(
            mode === "setup"
                ? `Wrote instance.cfg and mmc-pack.json to ${dir}`
                : `Wrote mmc-pack.json to ${dir}`,
        );
        console.log("Restart Prism (or reopen the instance) to pick up the changes.");
    });
}
