import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, matchesGlob } from "node:path";
import { BastionError, main } from "./lib/errors.ts";
import { run } from "./lib/exec.ts";
import { parseJavaMajor } from "./lib/java.ts";
import {
    readConfig,
    readLock,
    type LockProject,
    type PakkuConfig,
    type PakkuLock,
    type ProjectSide,
} from "./lib/lock.ts";
import { createModrinthClient, defaultUserAgent, type ModrinthProject } from "./lib/modrinth.ts";
import { verifySha256 } from "./lib/pakku.ts";
import { repoRoot } from "./lib/paths.ts";
import { checkInstanceLayout, mmcPackMatches } from "./prism.ts";

export type Finding = { level: "ok" | "warn" | "error"; message: string; docs?: string };

const TS = "docs/troubleshooting.md";
const SIDE_DOCS = "docs/guides/wrong-mod-side.md";

function expectedSide(mr: ModrinthProject): ProjectSide {
    if (mr.server_side === "unsupported") return "CLIENT";
    if (mr.client_side === "unsupported") return "SERVER";
    return "BOTH";
}

const sideKnown = (mr: ModrinthProject) =>
    mr.client_side !== "unknown" && mr.server_side !== "unknown";

function lockKeys(p: LockProject): string[] {
    return [...Object.values(p.slug), ...Object.values(p.name), ...Object.values(p.id)];
}

export function compareSides(
    lock: PakkuLock,
    config: PakkuConfig,
    mr: ModrinthProject[],
): Finding[] {
    const findings: Finding[] = [];
    for (const p of lock.projects) {
        const m = mr.find(
            (x) =>
                x.id === p.id["modrinth"] ||
                (p.slug["modrinth"] !== undefined && x.slug === p.slug["modrinth"]),
        );
        if (!m || !sideKnown(m)) continue;
        const key = lockKeys(p).find((k) => config.projects?.[k]?.side !== undefined);
        const override = key ? config.projects?.[key]?.side : undefined;
        const effective = override ?? p.side ?? "BOTH";
        const expected = expectedSide(m);
        if (effective === expected) continue;
        // An explicit pakku.json side on a mod Modrinth allows on both sides is a deliberate restriction.
        if (override !== undefined && expected === "BOTH") continue;
        findings.push({
            level: "warn",
            message:
                `${m.slug}: side is ${effective} but Modrinth says client=${m.client_side}, ` +
                `server=${m.server_side} (expected ${expected}). ` +
                `Add to pakku.json "projects": "${m.slug}": { "side": "${expected}" }`,
            docs: SIDE_DOCS,
        });
    }
    return findings;
}

function normalise(p: string): string {
    return p.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/+$/, "");
}

function walk(dir: string, prefix = ""): string[] {
    const out: string[] = [];
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        const rel = prefix ? `${prefix}/${e.name}` : e.name;
        if (e.isDirectory()) out.push(...walk(join(dir, e.name), rel));
        else out.push(rel);
    }
    return out;
}

export function findDuplicateOverrides(root: string, config: PakkuConfig): Finding[] {
    const serverDir = join(root, ".pakku", "server-overrides");
    if (!existsSync(serverDir)) return [];
    const all = config.overrides ?? [];
    const includes = all.filter((o) => !o.startsWith("!")).map(normalise);
    const excludes = all.filter((o) => o.startsWith("!")).map((o) => normalise(o.slice(1)));
    const matches = (o: string, rel: string) =>
        o.includes("*") ? matchesGlob(rel, o) : rel === o || rel.startsWith(`${o}/`);
    const findings: Finding[] = [];
    for (const rel of walk(serverDir)) {
        if (excludes.some((o) => matches(o, rel))) continue;
        const covered = includes.some((o) => matches(o, rel));
        if (covered && existsSync(join(root, rel))) {
            findings.push({
                level: "warn",
                message: `${rel} exists in both overrides and .pakku/server-overrides/ (Pakku #120 may export it twice)`,
                docs: `${TS}#duplicate-overrides`,
            });
        }
    }
    return findings;
}

export function checkConfigProjects(lock: PakkuLock, config: PakkuConfig): Finding[] {
    const known = new Set(lock.projects.flatMap(lockKeys));
    return Object.keys(config.projects ?? {})
        .filter((k) => !known.has(k))
        .map((k) => ({
            level: "warn" as const,
            message: `pakku.json projects."${k}" matches no mod in pakku-lock.json (stale entry?)`,
            docs: `${TS}#stale-config-project`,
        }));
}

const CA_CONFIG = "config/crash_assistant/config.toml";

/** Reads just help_link and modpack_creators from Crash Assistant's config (one value per line). */
export function parseCrashAssistantConfig(text: string): {
    helpLink?: string;
    creators?: string[];
} {
    const strings = (s: string) =>
        [...s.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]!.replace(/\\(.)/g, "$1"));
    const out: { helpLink?: string; creators?: string[] } = {};
    for (const line of text.split(/\r?\n/)) {
        const link = /^\s*help_link\s*=\s*(.*)$/.exec(line);
        if (link) out.helpLink = strings(link[1]!)[0] ?? "";
        const creators = /^\s*modpack_creators\s*=\s*(.*)$/.exec(line);
        if (creators) out.creators = strings(creators[1]!);
    }
    return out;
}

export function checkCrashAssistant(root: string, lock: PakkuLock): Finding[] {
    const file = join(root, CA_CONFIG);
    if (!lock.projects.some((p) => p.slug["modrinth"] === "crash-assistant")) return [];
    if (!existsSync(file)) return [];
    const cfg = parseCrashAssistantConfig(readFileSync(file, "utf8"));
    const fix = `run \`task init\`, or edit ${CA_CONFIG}`;
    const findings: Finding[] = [];
    if (!cfg.creators?.length || cfg.creators.includes("CHANGE_ME")) {
        findings.push({
            level: "warn",
            message: `Crash Assistant modpack_creators is empty or CHANGE_ME, so crash reports cannot diff against the pack's mod list (${fix})`,
            docs: `${TS}#crash-assistant-creators`,
        });
    }
    if (cfg.helpLink === "CHANGE_ME") {
        findings.push({
            level: "warn",
            message: `Crash Assistant help_link is CHANGE_ME, so its help button opens the NeoForge Discord (${fix})`,
            docs: `${TS}#crash-assistant-help-link`,
        });
    }
    return findings;
}

async function toolOutput(cmd: string, args: string[]): Promise<string | null> {
    try {
        const r = await run(cmd, args);
        return r.code === 0 ? (r.stdout + r.stderr).trim() : null;
    } catch {
        return null;
    }
}

async function toolChecks(root: string): Promise<Finding[]> {
    const out: Finding[] = [];
    const java = await toolOutput("java", ["-version"]);
    const jv = java === null ? null : parseJavaMajor(java);
    out.push(
        jv !== null && jv >= 21
            ? { level: "ok", message: `Java ${jv}` }
            : {
                  level: "error",
                  message: `Java 21+ required (found ${jv ?? "none"}); run \`mise install\``,
                  docs: `${TS}#java-version`,
              },
    );
    const node = Number(process.versions.node.split(".")[0]);
    out.push(
        node >= 26
            ? { level: "ok", message: `Node ${process.versions.node}` }
            : {
                  level: "error",
                  message: `Node 26+ required (found ${process.versions.node}); run \`mise install\``,
                  docs: `${TS}#node-version`,
              },
    );
    for (const tool of ["pnpm", "task"]) {
        const v = await toolOutput(tool, ["--version"]);
        out.push(
            v !== null
                ? { level: "ok", message: `${tool} ${v.split(/\r?\n/)[0]}` }
                : {
                      level: "error",
                      message: `${tool} not found on PATH; run \`mise install\``,
                      docs: `${TS}#tool-missing`,
                  },
        );
    }
    const sha = process.env["PAKKU_SHA256"];
    const jar = join(root, "pakku.jar");
    if (!sha) {
        out.push({
            level: "warn",
            message: "PAKKU_SHA256 not set; skipping pakku.jar check (run via `task doctor`)",
            docs: `${TS}#setup-env`,
        });
    } else if (!existsSync(jar)) {
        out.push({
            level: "error",
            message: "pakku.jar is missing; run `task setup`",
            docs: `${TS}#pakku-jar`,
        });
    } else if (await verifySha256(jar, sha)) {
        out.push({
            level: "ok",
            message: `pakku.jar matches pinned ${process.env["PAKKU_VERSION"] ?? "version"}`,
        });
    } else {
        out.push({
            level: "error",
            message: "pakku.jar hash differs from the pinned one; run `task setup` to re-download",
            docs: `${TS}#pakku-jar`,
        });
    }
    return out;
}

function prismCheck(root: string, lock: PakkuLock): Finding {
    const layout = checkInstanceLayout(root);
    if (!layout.ok) {
        return { level: "ok", message: "Prism: not inside a Prism instance (skipped)" };
    }
    return mmcPackMatches(layout.instanceDir, lock)
        ? { level: "ok", message: "Prism mmc-pack.json matches pakku-lock.json" }
        : {
              level: "warn",
              message: "Prism mmc-pack.json differs from pakku-lock.json; run `task prism:sync`",
              docs: `${TS}#prism-out-of-sync`,
          };
}

async function safe(name: string, fn: () => Finding[] | Promise<Finding[]>): Promise<Finding[]> {
    try {
        return await fn();
    } catch (e) {
        if (e instanceof BastionError) {
            return [
                { level: "error", message: e.message, docs: e.docs ?? `${TS}#doctor-check-failed` },
            ];
        }
        return [
            {
                level: "error",
                message: `${name} check failed: ${(e as Error).message}`,
                docs: `${TS}#doctor-check-failed`,
            },
        ];
    }
}

export async function runDoctor(root: string): Promise<Finding[]> {
    const findings = await safe("tool", () => toolChecks(root));
    let lock: PakkuLock | undefined;
    let config: PakkuConfig | undefined;
    findings.push(
        ...(await safe("pakku-lock.json", () => {
            lock = readLock(root);
            return [];
        })),
        ...(await safe("pakku.json", () => {
            config = readConfig(root);
            return [];
        })),
    );
    const skipped = (what: string): Finding => ({
        level: "warn",
        message: `${what} check skipped (pakku-lock.json or pakku.json unreadable)`,
        docs: `${TS}#doctor-check-failed`,
    });
    if (lock) {
        const l = lock;
        findings.push(...(await safe("Prism", () => [prismCheck(root, l)])));
    } else findings.push(skipped("Prism"));
    if (config) {
        const c = config;
        findings.push(...(await safe("overrides", () => findDuplicateOverrides(root, c))));
    } else findings.push(skipped("Overrides"));
    if (!lock || !config) {
        findings.push(skipped("Config projects"), skipped("Modrinth side"));
        return findings;
    }
    const l = lock;
    const c = config;
    findings.push(...(await safe("config projects", () => checkConfigProjects(l, c))));
    findings.push(...(await safe("Crash Assistant", () => checkCrashAssistant(root, l))));

    const ids = l.projects
        .map((p) => p.id["modrinth"] ?? p.slug["modrinth"])
        .filter((x): x is string => !!x);
    try {
        const client = createModrinthClient({ userAgent: await defaultUserAgent(root) });
        const mr = await client.getProjects(ids);
        const sides = compareSides(l, c, mr);
        findings.push(...sides);
        if (sides.length === 0) findings.push({ level: "ok", message: "Mod sides match Modrinth" });
    } catch (e) {
        findings.push({
            level: "warn",
            message: `Modrinth side check skipped: ${(e as Error).message}`,
            docs: `${TS}#modrinth-unreachable`,
        });
    }
    return findings;
}

const MARK = { ok: "✔", warn: "!", error: "✖" } as const;

export function formatFinding(f: Finding): string {
    return `${MARK[f.level]} ${f.message}${f.docs ? `\n    docs: ${f.docs}` : ""}`;
}

if (import.meta.main) {
    main(async () => {
        const findings = await runDoctor(repoRoot());
        for (const f of findings) console.log(formatFinding(f));
        if (findings.some((f) => f.level === "error")) process.exitCode = 1;
    });
}
