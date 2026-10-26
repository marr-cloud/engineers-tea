import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { BastionError } from "./errors.ts";
import { readConfig, readLock, writeConfig, type PakkuConfig } from "./lock.ts";
import { repoRoot } from "./paths.ts";

function tmp(t: TestContext): string {
    const dir = mkdtempSync(join(tmpdir(), "lock-test-"));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    return dir;
}

const fixture: PakkuConfig = {
    name: "Fixture",
    version: "1.0.0",
    overrides: ["config", "!kubejs/probe/**"],
    projects: { probejs: { side: "CLIENT", export: false } },
};

test("writeConfig then readConfig round-trips with key order preserved", (t) => {
    const dir = tmp(t);
    writeConfig(dir, fixture);
    const back = readConfig(dir);
    assert.deepEqual(back, fixture);
    assert.deepEqual(Object.keys(back), Object.keys(fixture));
});

test("writeConfig emits Pakku's own format: 4-space indent, no trailing newline", (t) => {
    const dir = tmp(t);
    writeConfig(dir, fixture);
    const text = readFileSync(join(dir, "pakku.json"), "utf8");
    assert.equal(text, JSON.stringify(fixture, null, 4));
    assert.ok(!text.endsWith("\n"));
    assert.ok(text.includes('\n    "name"'));
});

test("readLock reads the shape of the live lock", () => {
    // Shape only: packs legitimately change target, Minecraft version and loader.
    const lock = readLock(repoRoot());
    assert.ok(["modrinth", "curseforge", "multiplatform"].includes(lock.target));
    assert.ok(lock.mc_versions.length > 0);
    assert.ok(Object.keys(lock.loaders).length > 0);
    assert.ok(lock.projects.length > 0);
});

test("readLock throws a BastionError with docs when the lock is missing", (t) => {
    const dir = tmp(t);
    assert.throws(
        () => readLock(dir),
        (e) => e instanceof BastionError && !!e.docs?.includes("#"),
    );
});

test("readLock rejects null and a lock missing loaders", (t) => {
    const dir = tmp(t);
    writeFileSync(join(dir, "pakku-lock.json"), "null");
    assert.throws(
        () => readLock(dir),
        (e) => e instanceof BastionError && e.docs === "docs/troubleshooting.md#pakku-lock-invalid",
    );
    writeFileSync(
        join(dir, "pakku-lock.json"),
        JSON.stringify({ target: "modrinth", mc_versions: ["1.21.1"], projects: [] }),
    );
    assert.throws(
        () => readLock(dir),
        (e) =>
            e instanceof BastionError &&
            !!e.hint?.includes("loaders") &&
            e.docs === "docs/troubleshooting.md#pakku-lock-invalid",
    );
});

test("readConfig rejects a config missing version", (t) => {
    const dir = tmp(t);
    writeFileSync(join(dir, "pakku.json"), JSON.stringify({ name: "x" }));
    assert.throws(
        () => readConfig(dir),
        (e) =>
            e instanceof BastionError &&
            !!e.hint?.includes("version") &&
            e.docs === "docs/troubleshooting.md#pakku-config-invalid",
    );
});
