import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BastionError } from "./errors.ts";

export type ProjectSide = "CLIENT" | "SERVER" | "BOTH";

export type LockProject = {
    pakku_id: string;
    type: string;
    side?: ProjectSide;
    slug: Record<string, string>;
    name: Record<string, string>;
    id: Record<string, string>;
    files: unknown[];
};

export type PakkuLock = {
    target: string;
    mc_versions: string[];
    loaders: Record<string, string>;
    projects: LockProject[];
};

export type PakkuConfig = {
    name: string;
    version: string;
    description?: string;
    author?: string;
    overrides?: string[];
    server_overrides?: string[];
    client_overrides?: string[];
    projects?: Record<
        string,
        {
            side?: ProjectSide;
            export?: boolean;
            update_strategy?: string;
            redistributable?: boolean;
        }
    >;
    export_server_side_projects_to_client?: boolean;
};

const DOCS = "docs/troubleshooting.md";

function readJson(file: string, docs: string): unknown {
    let text: string;
    try {
        text = readFileSync(file, "utf8");
    } catch (e) {
        throw new BastionError(`Cannot read ${file}: ${(e as Error).message}`, {
            hint: "run from the BastionPack repository; regenerate the lock with `pakku` if it is missing",
            docs,
        });
    }
    try {
        return JSON.parse(text);
    } catch (e) {
        throw new BastionError(`${file} is not valid JSON: ${(e as Error).message}`, {
            hint: "restore the file from git; never hand-edit pakku-lock.json",
            docs,
        });
    }
}

const isString = (v: unknown) => typeof v === "string";
const isArray = (v: unknown) => Array.isArray(v);
const isObject = (v: unknown) => typeof v === "object" && v !== null && !Array.isArray(v);

function requireShape(
    value: unknown,
    file: string,
    docs: string,
    checks: Record<string, (v: unknown) => boolean>,
): Record<string, unknown> {
    const fail = (hint: string): never => {
        throw new BastionError(`${file} has an unexpected shape`, {
            hint,
            docs,
        });
    };
    if (!isObject(value)) {
        return fail("expected a JSON object at the top level; restore the file from git");
    }
    const obj = value as Record<string, unknown>;
    for (const [field, ok] of Object.entries(checks)) {
        if (!ok(obj[field])) {
            return fail(`missing or invalid field "${field}"; restore the file from git`);
        }
    }
    return obj;
}

export function readLock(root: string): PakkuLock {
    const file = join(root, "pakku-lock.json");
    return requireShape(
        readJson(file, `${DOCS}#pakku-lock-invalid`),
        file,
        `${DOCS}#pakku-lock-invalid`,
        {
            target: isString,
            mc_versions: isArray,
            loaders: isObject,
            projects: isArray,
        },
    ) as unknown as PakkuLock;
}

export function readConfig(root: string): PakkuConfig {
    const file = join(root, "pakku.json");
    return requireShape(
        readJson(file, `${DOCS}#pakku-config-invalid`),
        file,
        `${DOCS}#pakku-config-invalid`,
        {
            name: isString,
            version: isString,
        },
    ) as unknown as PakkuConfig;
}

/** Writes the exact format Pakku itself emits: 4-space indent, no trailing newline. */
export function writeConfig(root: string, cfg: PakkuConfig): void {
    writeFileSync(join(root, "pakku.json"), JSON.stringify(cfg, null, 4));
}
