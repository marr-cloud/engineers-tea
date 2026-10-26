import { readFile } from "node:fs/promises";
import { unzipSync } from "fflate";
import { BastionError } from "./errors.ts";

export type MrpackIndex = {
    formatVersion: number;
    name: string;
    versionId: string;
    dependencies: Record<string, string>;
    files: { path: string; env?: { client: string; server: string } }[];
};

const OVERRIDE_PREFIXES = ["overrides/", "client-overrides/", "server-overrides/"];

async function unzip(file: string, filter?: (name: string) => boolean) {
    try {
        return unzipSync(
            new Uint8Array(await readFile(file)),
            filter ? { filter: (f) => filter(f.name) } : {},
        );
    } catch (e) {
        throw new BastionError(`Cannot read ${file} as an .mrpack: ${(e as Error).message}`, {
            hint: "re-run `task build`; the file may be truncated or not a modpack",
            docs: "docs/troubleshooting.md#mrpack-invalid",
        });
    }
}

export async function readMrpackIndex(file: string): Promise<MrpackIndex> {
    const entries = await unzip(file, (n) => n === "modrinth.index.json");
    const raw = entries["modrinth.index.json"];
    if (!raw) {
        throw new BastionError(`${file} has no modrinth.index.json`, {
            hint: "re-run `task build`; this does not look like a Modrinth modpack",
            docs: "docs/troubleshooting.md#mrpack-invalid",
        });
    }
    try {
        return JSON.parse(new TextDecoder().decode(raw)) as MrpackIndex;
    } catch (e) {
        throw new BastionError(
            `modrinth.index.json in ${file} is not valid JSON: ${(e as Error).message}`,
            {
                hint: "re-run `task build`",
                docs: "docs/troubleshooting.md#mrpack-invalid",
            },
        );
    }
}

/** File entries under `overrides/`, `client-overrides/` and `server-overrides/`. */
export async function listOverrides(file: string): Promise<string[]> {
    const entries = await unzip(file, (n) => OVERRIDE_PREFIXES.some((p) => n.startsWith(p)));
    return Object.keys(entries).filter((n) => !n.endsWith("/"));
}
