import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BastionError } from "./errors.ts";

/** Walks up from `from` to the directory containing `pakku.json`. */
export function repoRoot(from: string = dirname(fileURLToPath(import.meta.url))): string {
    let dir = resolve(from);
    for (;;) {
        if (existsSync(resolve(dir, "pakku.json"))) return dir;
        const parent = dirname(dir);
        if (parent === dir) {
            throw new BastionError("Could not find pakku.json in any parent directory", {
                hint: "run this command from inside the BastionPack repository",
                docs: "docs/troubleshooting.md#repo-root-not-found",
            });
        }
        dir = parent;
    }
}
