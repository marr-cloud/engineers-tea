import {
    appendFileSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { BastionError, main } from "./lib/errors.ts";
import { run, type RunResult } from "./lib/exec.ts";
import { readConfig } from "./lib/lock.ts";
import { readMrpackIndex } from "./lib/mrpack.ts";
import { pakku } from "./lib/pakku.ts";
import { repoRoot } from "./lib/paths.ts";
import { previousReleaseTag } from "./lib/semver.ts";
import { findMrpack } from "./publish-modrinth.ts";

const DOCS = "docs/troubleshooting.md";

export type SummaryInput = {
    name: string;
    version: string;
    mc: string;
    loader: string;
    modCount: number;
    diff: string | null;
};

export function renderSummary(i: SummaryInput): string {
    const lines = [
        `## ${i.name} ${i.version}`,
        "",
        "| | |",
        "| --- | --- |",
        `| Minecraft | ${i.mc} |`,
        `| Loader | ${i.loader} |`,
        `| Mods | ${i.modCount} |`,
        "",
        "### Changes since the last release",
        "",
        i.diff === null ? "No previous release tag — this is the first build." : i.diff.trim(),
        "",
    ];
    return lines.join("\n");
}

export type DiffDeps = {
    git: (args: string[]) => Promise<RunResult>;
    pakku: (args: string[]) => Promise<RunResult>;
};

/** Markdown diff of the mods between `<prevTag>`'s pakku-lock.json and the current one; null without a tag. */
export async function lockDiffSince(
    prevTag: string | null,
    root: string,
    deps?: Partial<DiffDeps>,
): Promise<string | null> {
    if (prevTag === null) return null;
    const git = deps?.git ?? ((a: string[]) => run("git", a, { cwd: root }));
    const runPakku = deps?.pakku ?? ((a: string[]) => pakku(a, { cwd: root }));
    const old = await git(["show", `${prevTag}:pakku-lock.json`]);
    if (old.code !== 0) {
        return `Release ${prevTag} has no \`pakku-lock.json\`, so the mod changes cannot be compared.`;
    }
    const buildDir = join(root, "build");
    mkdirSync(buildDir, { recursive: true });
    const tmp = mkdtempSync(join(buildDir, ".lock-diff-"));
    try {
        const oldLock = join(tmp, "old-pakku-lock.json");
        const outFile = join(tmp, "diff.md");
        writeFileSync(oldLock, old.stdout);
        const d = await runPakku([
            "diff",
            `--markdown=${outFile}`,
            "--header-size=4",
            oldLock,
            join(root, "pakku-lock.json"),
        ]);
        if (d.code !== 0) {
            throw new BastionError(`pakku diff failed (exit ${d.code})`, {
                hint: d.stderr.trim() || "run `task setup` and retry",
                docs: `${DOCS}#summary-diff-failed`,
            });
        }
        let md = "";
        try {
            md = readFileSync(outFile, "utf8").trim();
        } catch {
            // Pakku writes no file when nothing changed
        }
        return md || `No mod changes since ${prevTag}.`;
    } finally {
        rmSync(tmp, { recursive: true, force: true });
    }
}

/** Informational variant for the CLI: a failed diff becomes a warning plus a note, never an error. */
export async function safeLockDiff(
    prevTag: string | null,
    root: string,
    diffFn: (prevTag: string | null, root: string) => Promise<string | null> = lockDiffSince,
    warn: (msg: string) => void = (m) =>
        console.warn(
            process.env["GITHUB_ACTIONS"] === "true" ? `::warning::${m}` : `warning: ${m}`,
        ),
): Promise<string | null> {
    try {
        return await diffFn(prevTag, root);
    } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        warn(`Mod diff unavailable: ${reason}`);
        return `Mod diff unavailable: ${reason}`;
    }
}

if (import.meta.main) {
    main(async () => {
        const root = repoRoot();
        const index = await readMrpackIndex(findMrpack(root));
        const config = readConfig(root);
        const tags = (await run("git", ["tag", "--list"], { cwd: root })).stdout
            .split(/\r?\n/)
            .filter(Boolean);
        const diff = await safeLockDiff(previousReleaseTag(tags), root);
        const loader =
            ["neoforge", "forge", "fabric-loader", "quilt-loader"].find(
                (k) => index.dependencies[k],
            ) ?? "unknown";
        const md = renderSummary({
            name: index.name || config.name,
            version: index.versionId,
            mc: index.dependencies["minecraft"] ?? "unknown",
            loader,
            modCount: index.files.length,
            diff,
        });
        const target = process.env["GITHUB_STEP_SUMMARY"];
        if (target) appendFileSync(target, md);
        else console.log(md);
    });
}
