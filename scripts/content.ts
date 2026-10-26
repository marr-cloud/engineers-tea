import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { BastionError, main } from "./lib/errors.ts";
import { repoRoot } from "./lib/paths.ts";

const NAMESPACE = "engineers_tea";
const LANG_DIR = `kubejs/assets/${NAMESPACE}/lang`;
const TEXTURE_DIR = `kubejs/assets/${NAMESPACE}/textures/item`;
const LANGS = ["en_us", "es_es", "es_mx"];
const QUESTS_DIR = "config/heracles/quests";

/** Ids passed to `.create('engineers_tea:<id>')` in a startup script, without the namespace. */
export function findRegisteredItems(source: string): string[] {
    const re = new RegExp(String.raw`\.create\(\s*['"]${NAMESPACE}:([a-z0-9_/]+)['"]`, "g");
    return [...source.matchAll(re)].map((m) => m[1] ?? "");
}

function files(dir: string, ext: string, out: string[] = []): string[] {
    if (!existsSync(dir)) return out;
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) files(p, ext, out);
        else if (name.endsWith(ext)) out.push(p);
    }
    return out;
}

function translateKeys(value: unknown, out: string[] = []): string[] {
    if (Array.isArray(value)) for (const v of value) translateKeys(v, out);
    else if (value !== null && typeof value === "object") {
        for (const [k, v] of Object.entries(value)) {
            if (k === "translate" && typeof v === "string") out.push(v);
            else translateKeys(v, out);
        }
    }
    return out;
}

/** Lang parity, item lang keys and textures, and quest translate keys. Empty means ok. */
export function checkContent(root: string): string[] {
    const problems: string[] = [];
    const lang = new Map<string, Set<string>>();
    for (const l of LANGS) {
        const file = `${LANG_DIR}/${l}.json`;
        try {
            lang.set(l, new Set(Object.keys(JSON.parse(readFileSync(join(root, file), "utf8")))));
        } catch (e) {
            problems.push(`${file}: cannot read (${(e as Error).message})`);
        }
    }
    const en = lang.get("en_us") ?? new Set<string>();
    const all = new Set([...lang.values()].flatMap((s) => [...s]));
    for (const [l, keys] of lang) {
        for (const k of all)
            if (!keys.has(k)) problems.push(`${LANG_DIR}/${l}.json: missing key ${k}`);
    }

    for (const script of files(join(root, "kubejs/startup_scripts"), ".js")) {
        for (const id of findRegisteredItems(readFileSync(script, "utf8"))) {
            const key = `item.${NAMESPACE}.${id}`;
            if (lang.has("en_us") && !en.has(key))
                problems.push(`${LANG_DIR}/en_us.json: missing key ${key}`);
            const texture = `${TEXTURE_DIR}/${id}.png`;
            if (!existsSync(join(root, texture)))
                problems.push(`${texture}: missing texture for ${NAMESPACE}:${id}`);
        }
    }

    for (const quest of files(join(root, QUESTS_DIR), ".json")) {
        const rel = relative(root, quest).replaceAll("\\", "/");
        let json: unknown;
        try {
            json = JSON.parse(readFileSync(quest, "utf8"));
        } catch (e) {
            problems.push(`${rel}: invalid JSON (${(e as Error).message})`);
            continue;
        }
        for (const key of translateKeys(json)) {
            if (!en.has(key)) problems.push(`${rel}: translate key ${key} is not in en_us.json`);
        }
    }
    return [...new Set(problems)];
}

if (import.meta.main) {
    await main(async () => {
        const problems = checkContent(repoRoot());
        if (problems.length > 0) {
            throw new BastionError(
                `content check found ${problems.length} problem(s):\n  ${problems.join("\n  ")}`,
                {
                    hint: "add the missing lang keys or textures, then run `task check` again",
                    docs: "docs/troubleshooting.md#content-check",
                },
            );
        }
        console.log("content ok");
    });
}
