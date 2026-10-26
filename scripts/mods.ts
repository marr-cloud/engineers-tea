import { copyFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { BastionError, main } from "./lib/errors.ts";
import { readLock } from "./lib/lock.ts";
import { createModrinthClient, defaultUserAgent, formatSearchTable } from "./lib/modrinth.ts";
import type { RunResult } from "./lib/exec.ts";
import { pakku } from "./lib/pakku.ts";
import { repoRoot } from "./lib/paths.ts";

const USAGE_DOCS = "docs/troubleshooting.md#mods-usage";

export type ModsCommand = { cmd: "find" | "add" | "rm" | "update"; rest: string[] };

export function parseModsArgs(argv: string[]): ModsCommand {
    const [cmd, ...rest] = argv;
    if (cmd !== "find" && cmd !== "add" && cmd !== "rm" && cmd !== "update") {
        throw new BastionError(`Unknown mods command: ${cmd ?? "(none)"}`, {
            hint: "use task mods:find|mods:add|mods:rm|mods:update",
            docs: USAGE_DOCS,
        });
    }
    if (cmd !== "update" && rest.length === 0) {
        throw new BastionError(`mods:${cmd} needs at least one argument`, {
            hint: `e.g. task mods:${cmd} -- <${cmd === "find" ? "query" : "slug"}>`,
            docs: USAGE_DOCS,
        });
    }
    return { cmd, rest };
}

async function find(root: string, query: string): Promise<void> {
    const lock = readLock(root);
    const gameVersion = lock.mc_versions[0];
    const loader = Object.keys(lock.loaders)[0];
    if (!gameVersion || !loader) {
        throw new BastionError("pakku-lock.json has no Minecraft version or loader", {
            hint: "restore pakku-lock.json from git",
            docs: "docs/troubleshooting.md#pakku-lock-invalid",
        });
    }
    const client = createModrinthClient({
        userAgent: await defaultUserAgent(root),
        token: process.env.MODRINTH_TOKEN,
    });
    const hits = await client.search(query, { gameVersion, loader });
    console.log(
        hits.length
            ? formatSearchTable(hits)
            : `No ${loader} mods found for "${query}" on ${gameVersion}`,
    );
}

export type ChangeDeps = {
    pakku: (args: string[], opts?: { inherit?: boolean }) => Promise<RunResult>;
    log: (line: string) => void;
};

export async function changeMods(
    root: string,
    cmd: "add" | "rm" | "update",
    rest: string[],
    deps: ChangeDeps = { pakku, log: console.log },
): Promise<void> {
    readLock(root); // validates the lock exists and is well-formed
    const lockPath = join(root, "pakku-lock.json");
    const before = join(root, "build", ".lock-before.json");
    mkdirSync(dirname(before), { recursive: true });
    copyFileSync(lockPath, before);
    const args = cmd === "update" ? ["update", ...(rest.length ? rest : ["-a"])] : [cmd, ...rest];
    try {
        const r = await deps.pakku(args, { inherit: true });
        const changed = readFileSync(lockPath, "utf8") !== readFileSync(before, "utf8");
        if (r.code !== 0 && !changed) {
            throw new BastionError(`pakku ${args.join(" ")} failed (exit ${r.code})`, {
                hint: "read the Pakku output above; check the slugs with `task mods:find`",
                docs: "docs/troubleshooting.md#mods-pakku-failed",
            });
        }
        const d = await deps.pakku(["diff", "-v", before, lockPath]);
        if (d.code !== 0) {
            throw new BastionError(`pakku diff failed (exit ${d.code})`, {
                hint: d.stderr.trim() || "run `task setup` and retry",
                docs: "docs/troubleshooting.md#mods-pakku-failed",
            });
        }
        deps.log(d.stdout.trim() || "No changes to the lock.");
        if (r.code !== 0) {
            throw new BastionError(
                `pakku ${args.join(" ")} failed (exit ${r.code}) after changing the lock`,
                {
                    hint: "review the diff above; `git checkout pakku-lock.json pakku.json` to undo",
                    docs: "docs/troubleshooting.md#mods-pakku-failed",
                },
            );
        }
    } finally {
        rmSync(before, { force: true });
    }
}

if (import.meta.main) {
    main(async () => {
        const { cmd, rest } = parseModsArgs(process.argv.slice(2));
        const root = repoRoot();
        if (cmd === "find") await find(root, rest.join(" "));
        else await changeMods(root, cmd, rest);
    });
}
