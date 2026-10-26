import { writeFileSync } from "node:fs";
import { readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { BastionError, main } from "./lib/errors.ts";
import { run } from "./lib/exec.ts";
import { pakku } from "./lib/pakku.ts";
import { repoRoot } from "./lib/paths.ts";
import { isSemver, previousReleaseTag } from "./lib/semver.ts";
import { devVersion } from "./lib/version.ts";

const EXPORT_DOCS = "docs/troubleshooting.md#export-failed";

async function findFile(dir: string, ext: string): Promise<string | undefined> {
    const names = await readdir(dir).catch(() => [] as string[]);
    const name = names.filter((n) => n.endsWith(ext)).sort()[0];
    return name === undefined ? undefined : join(dir, name);
}

/** Restores `file` on SIGINT/SIGTERM (Node dies before `finally` runs); returns a disposer. */
export function restoreOnSignal(
    file: string,
    original: Buffer,
    exit: (code: number) => void = (c) => process.exit(c),
): () => void {
    const codes: [NodeJS.Signals, number][] = [
        ["SIGINT", 130],
        ["SIGTERM", 143],
    ];
    const registered: [NodeJS.Signals, () => void][] = [];
    for (const [sig, code] of codes) {
        const fn = () => {
            try {
                writeFileSync(file, original);
            } catch {
                // best effort; nothing more can be done while dying
            }
            exit(code);
        };
        process.once(sig, fn);
        registered.push([sig, fn]);
    }
    return () => {
        for (const [sig, fn] of registered) process.removeListener(sig, fn);
    };
}

export async function build(opts: {
    root: string;
    version: string;
    serverpack: boolean;
    pakkuRunner?: typeof pakku;
}): Promise<{ mrpack: string; serverpack?: string }> {
    const runPakku = opts.pakkuRunner ?? pakku;
    const configFile = join(opts.root, "pakku.json");
    const modrinthDir = join(opts.root, "build", "modrinth");
    const serverDir = join(opts.root, "build", "serverpack");

    // Clear stale artifacts so we can never return one from a previous build (keep build/.cache).
    await rm(modrinthDir, { recursive: true, force: true });
    if (opts.serverpack) await rm(serverDir, { recursive: true, force: true });

    // Restore the exact original bytes; `pakku cfg` rewrites the file in its own format.
    const original = await readFile(configFile);
    const dispose = restoreOnSignal(configFile, original);
    let failure: unknown;
    try {
        // Export hashes GitHub-hosted mods from their downloaded jars and silently drops
        // the ones it cannot find, so make sure every file in the lock is present first.
        const fetched = await runPakku(["fetch"], { cwd: opts.root, inherit: true });
        if (fetched.code !== 0) {
            throw new BastionError(`pakku fetch failed (exit ${fetched.code})`, {
                hint:
                    fetched.stderr.trim() ||
                    "see the Pakku output above; check your connection and run `task setup`",
                docs: EXPORT_DOCS,
            });
        }
        const cfg = await runPakku(["cfg", "-v", opts.version], { cwd: opts.root });
        if (cfg.code !== 0) {
            throw new BastionError(`pakku cfg -v ${opts.version} failed (exit ${cfg.code})`, {
                hint: cfg.stderr.trim() || "see the Pakku output above",
                docs: EXPORT_DOCS,
            });
        }
        const args = opts.serverpack ? ["export"] : ["export", "--no-server"];
        const exp = await runPakku(args, { cwd: opts.root, inherit: true });
        if (exp.code !== 0) {
            throw new BastionError(`pakku export failed (exit ${exp.code})`, {
                hint:
                    exp.stderr.trim() ||
                    "see the Pakku output above; try `task setup` to refetch mods",
                docs: EXPORT_DOCS,
            });
        }
    } catch (e) {
        failure = e;
    } finally {
        dispose();
        try {
            writeFileSync(configFile, original);
        } catch (e) {
            const restore = new BastionError(
                `could not restore pakku.json: ${(e as Error).message}`,
                {
                    hint: "run `git checkout -- pakku.json`",
                    docs: EXPORT_DOCS,
                },
            );
            if (failure === undefined) failure = restore;
            else {
                (failure as Error).message += `; additionally ${restore.message} (${restore.hint})`;
            }
        }
    }
    if (failure !== undefined) throw failure;

    const mrpack = await findFile(modrinthDir, ".mrpack");
    if (!mrpack) {
        throw new BastionError("pakku export finished but produced no .mrpack", {
            hint: "check the Pakku output above and that build/modrinth/ is writable",
            docs: EXPORT_DOCS,
        });
    }
    if (!opts.serverpack) return { mrpack };
    const serverpack = await findFile(serverDir, ".zip");
    if (!serverpack) {
        throw new BastionError("pakku export finished but produced no serverpack zip", {
            hint: "check the Pakku output above; the serverpack needs server-side mods in the lock",
            docs: EXPORT_DOCS,
        });
    }
    return { mrpack, serverpack };
}

async function git(root: string, args: string[]): Promise<string> {
    const r = await run("git", args, { cwd: root });
    if (r.code !== 0) {
        throw new BastionError(`git ${args.join(" ")} failed`, {
            hint: r.stderr.trim() || "pass VERSION=x.y.z to skip git detection",
            docs: "docs/troubleshooting.md#version-detect",
        });
    }
    return r.stdout.trim();
}

if (import.meta.main) {
    main(async () => {
        const root = repoRoot();
        let version = process.env.VERSION?.trim();
        if (version) {
            if (!isSemver(version)) {
                throw new BastionError(`VERSION "${version}" is not a valid semver`, {
                    hint: "use MAJOR.MINOR.PATCH with an optional -prerelease and no leading v, e.g. 1.2.0",
                    docs: "docs/troubleshooting.md#invalid-version",
                });
            }
        } else {
            const tags = (await git(root, ["tag", "--list"])).split(/\r?\n/).filter(Boolean);
            const sha = await git(root, ["rev-parse", "HEAD"]);
            version = devVersion({ lastTag: previousReleaseTag(tags), sha });
        }
        const serverpack = process.env.SERVERPACK === "true";
        console.log(`Building BastionPack ${version}${serverpack ? " (with serverpack)" : ""}`);
        const out = await build({ root, version, serverpack });
        console.log(`mrpack: ${out.mrpack}`);
        if (out.serverpack) console.log(`serverpack: ${out.serverpack}`);
    });
}
