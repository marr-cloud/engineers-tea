import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import {
    checkConfigProjects,
    checkCrashAssistant,
    compareSides,
    findDuplicateOverrides,
    parseCrashAssistantConfig,
    runDoctor,
} from "./doctor.ts";
import type { LockProject, PakkuConfig, PakkuLock } from "./lib/lock.ts";
import type { ModrinthProject } from "./lib/modrinth.ts";

function proj(slug: string, id: string, side?: LockProject["side"]): LockProject {
    return {
        pakku_id: `pk-${slug}`,
        type: "MOD",
        side,
        slug: { modrinth: slug },
        name: { modrinth: slug.toUpperCase() },
        id: { modrinth: id },
        files: [],
    };
}
const lockOf = (...projects: LockProject[]): PakkuLock => ({
    target: "modrinth",
    mc_versions: ["1.21.1"],
    loaders: { neoforge: "21.1.264" },
    projects,
});
const mr = (slug: string, id: string, client: string, server: string): ModrinthProject => ({
    id,
    slug,
    title: slug,
    downloads: 1,
    client_side: client,
    server_side: server,
    updated: "",
    license: { id: "MIT" },
});
const cfg = (
    projects?: PakkuConfig["projects"],
    extra: Partial<PakkuConfig> = {},
): PakkuConfig => ({
    name: "t",
    version: "0",
    projects,
    ...extra,
});

test("client-only mod with side BOTH warns with the exact snippet", () => {
    const f = compareSides(lockOf(proj("sodium", "AANobbMI", "BOTH")), cfg(), [
        mr("sodium", "AANobbMI", "required", "unsupported"),
    ]);
    assert.equal(f.length, 1);
    assert.equal(f[0]!.level, "warn");
    assert.ok(f[0]!.message.includes('"sodium": { "side": "CLIENT" }'));
    assert.equal(f[0]!.docs, "docs/guides/wrong-mod-side.md");
});

test("config override already CLIENT: no finding", () => {
    const f = compareSides(
        lockOf(proj("sodium", "AANobbMI", "BOTH")),
        cfg({ sodium: { side: "CLIENT" } }),
        [mr("sodium", "AANobbMI", "required", "unsupported")],
    );
    assert.deepEqual(f, []);
});

test("Create: lock SERVER but Modrinth optional/required expects BOTH", () => {
    const f = compareSides(lockOf(proj("create", "LNytGWDc", "SERVER")), cfg(), [
        mr("create", "LNytGWDc", "optional", "required"),
    ]);
    assert.equal(f.length, 1);
    assert.ok(f[0]!.message.includes('"create": { "side": "BOTH" }'));
});

test("server-only mod matching lock SERVER: no finding", () => {
    const f = compareSides(lockOf(proj("noisium", "KuNKN7d2", "SERVER")), cfg(), [
        mr("noisium", "KuNKN7d2", "unsupported", "required"),
    ]);
    assert.deepEqual(f, []);
});

test("explicit config restriction of a both-sides mod is not flagged", () => {
    const f = compareSides(
        lockOf(proj("probejs", "abc", "CLIENT")),
        cfg({ probejs: { side: "CLIENT" } }),
        [mr("probejs", "abc", "required", "required")],
    );
    assert.deepEqual(f, []);
});

test("config key may be the project id", () => {
    const f = compareSides(
        lockOf(proj("sodium", "AANobbMI")),
        cfg({ AANobbMI: { side: "CLIENT" } }),
        [mr("sodium", "AANobbMI", "required", "unsupported")],
    );
    assert.deepEqual(f, []);
});

let root: string;
beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "doctor-test-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));
const put = (rel: string) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), "x");
};

test("duplicate override file names the file", () => {
    put("config/foo.toml");
    put(".pakku/server-overrides/config/foo.toml");
    put(".pakku/server-overrides/config/only-server.toml");
    const f = findDuplicateOverrides(root, cfg(undefined, { overrides: ["config", "!config/x"] }));
    assert.equal(f.length, 1);
    assert.equal(f[0]!.level, "warn");
    assert.ok(f[0]!.message.includes("config/foo.toml"));
});

test("no server-overrides dir: no findings", () => {
    assert.deepEqual(findDuplicateOverrides(root, cfg(undefined, { overrides: ["config"] })), []);
});

test("stale config project warns; slug, name and id keys are fine", () => {
    const lock = lockOf(proj("sodium", "AANobbMI"));
    const f = checkConfigProjects(
        lock,
        cfg({
            oldmod: { side: "CLIENT" },
            sodium: {},
            SODIUM: {},
            AANobbMI: {},
        }),
    );
    assert.equal(f.length, 1);
    assert.equal(f[0]!.level, "warn");
    assert.ok(f[0]!.message.includes("oldmod"));
});

test("negated override is applied", () => {
    put("config/x/a.toml");
    put(".pakku/server-overrides/config/x/a.toml");
    const f = findDuplicateOverrides(root, cfg(undefined, { overrides: ["config", "!config/x"] }));
    assert.deepEqual(f, []);
});

test("glob override entries match", () => {
    put("config/sub/a.toml");
    put(".pakku/server-overrides/config/sub/a.toml");
    const f = findDuplicateOverrides(root, cfg(undefined, { overrides: ["config/**/*.toml"] }));
    assert.equal(f.length, 1);
    assert.ok(f[0]!.message.includes("config/sub/a.toml"));
});

test("unknown Modrinth side is skipped", () => {
    const f = compareSides(lockOf(proj("m", "id1", "SERVER")), cfg(), [
        mr("m", "id1", "unknown", "required"),
    ]);
    assert.deepEqual(f, []);
});

test("malformed lock still reports tool checks and a lock error", async () => {
    writeFileSync(join(root, "pakku-lock.json"), "{nope");
    writeFileSync(join(root, "pakku.json"), JSON.stringify({ name: "t", version: "0" }));
    const f = await runDoctor(root);
    assert.ok(f.some((x) => x.message.includes("Node")));
    assert.ok(f.some((x) => x.level === "error" && x.message.includes("pakku-lock.json")));
});

const CA = "config/crash_assistant/config.toml";
const caToml = (link: string, creators: string) =>
    `[general]\r\n\t#help_link = "ignored"\r\n\thelp_link = ${link}\r\n[modpack_modlist]\r\n\tmodpack_creators = ${creators}\r\n`;
const withCa = lockOf(proj("crash-assistant", "ca1"));
const putCa = (text: string) => {
    mkdirSync(join(root, "config/crash_assistant"), { recursive: true });
    writeFileSync(join(root, CA), text);
};

test("parseCrashAssistantConfig reads help_link and creators, ignoring comments", () => {
    assert.deepEqual(parseCrashAssistantConfig(caToml('"https://x.dev"', '["a", "b\\"c"]')), {
        helpLink: "https://x.dev",
        creators: ["a", 'b"c'],
    });
    assert.deepEqual(parseCrashAssistantConfig(caToml('"x"', "[]")).creators, []);
    assert.deepEqual(parseCrashAssistantConfig("[general]\n"), {});
});

test("Crash Assistant placeholders produce two separate warnings with docs anchors", () => {
    putCa(caToml('"CHANGE_ME"', '["CHANGE_ME"]'));
    const f = checkCrashAssistant(root, withCa);
    assert.equal(f.length, 2);
    assert.ok(f.every((x) => x.level === "warn" && x.message.includes("task init")));
    assert.ok(f[0]!.docs!.endsWith("#crash-assistant-creators"));
    assert.ok(f[1]!.docs!.endsWith("#crash-assistant-help-link"));
});

test("empty creators warn; real values do not", () => {
    putCa(caToml('"https://x.dev"', "[]"));
    const f = checkCrashAssistant(root, withCa);
    assert.equal(f.length, 1);
    assert.ok(f[0]!.docs!.endsWith("#crash-assistant-creators"));
    putCa(caToml('"https://x.dev"', '["Ann"]'));
    assert.deepEqual(checkCrashAssistant(root, withCa), []);
});

test("Crash Assistant check is skipped without the mod or without the file", () => {
    putCa(caToml('"CHANGE_ME"', "[]"));
    assert.deepEqual(checkCrashAssistant(root, lockOf(proj("sodium", "s1"))), []);
    rmSync(join(root, CA));
    assert.deepEqual(checkCrashAssistant(root, withCa), []);
});
