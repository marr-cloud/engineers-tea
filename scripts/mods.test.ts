import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { changeMods, parseModsArgs } from "./mods.ts";
import { BastionError } from "./lib/errors.ts";

test("find/add/rm require arguments", () => {
    for (const cmd of ["find", "add", "rm"]) {
        assert.throws(() => parseModsArgs([cmd]), BastionError);
    }
});

test("update accepts no arguments", () => {
    assert.deepEqual(parseModsArgs(["update"]), { cmd: "update", rest: [] });
});

test("find joins the query", () => {
    assert.deepEqual(parseModsArgs(["find", "iron", "farming"]), {
        cmd: "find",
        rest: ["iron", "farming"],
    });
});

test("unknown command is rejected", () => {
    assert.throws(() => parseModsArgs(["nope"]), BastionError);
    assert.throws(() => parseModsArgs([]), BastionError);
});

const LOCK = JSON.stringify({
    target: "modrinth",
    mc_versions: ["1.21.1"],
    loaders: { neoforge: "1" },
    projects: [],
});
const res = (code: number, stdout = "", stderr = "") => ({ code, stdout, stderr });

function fixture(withLock = true): string {
    const dir = mkdtempSync(join(tmpdir(), "bp-mods-"));
    if (withLock) writeFileSync(join(dir, "pakku-lock.json"), LOCK);
    return dir;
}

test("missing lock -> pakku-lock-invalid", async () => {
    const dir = fixture(false);
    try {
        await assert.rejects(
            changeMods(dir, "add", ["x"], { pakku: async () => res(0), log: () => {} }),
            (e: BastionError) => e instanceof BastionError && /pakku-lock-invalid/.test(e.docs!),
        );
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test("diff failure is an error, not 'No changes'", async () => {
    const dir = fixture();
    const logs: string[] = [];
    try {
        await assert.rejects(
            changeMods(dir, "add", ["x"], {
                pakku: async (a) => (a[0] === "diff" ? res(1, "", "boom") : res(0)),
                log: (l) => logs.push(l),
            }),
            (e: BastionError) => e instanceof BastionError && e.hint === "boom",
        );
        assert.deepEqual(logs, []);
        assert.ok(!existsSync(join(dir, "build", ".lock-before.json")));
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test("pakku failure after lock change prints diff then errors; temp file removed", async () => {
    const dir = fixture();
    const logs: string[] = [];
    try {
        await assert.rejects(
            changeMods(dir, "add", ["x"], {
                pakku: async (a) => {
                    if (a[0] === "diff") return res(0, "+ x");
                    writeFileSync(join(dir, "pakku-lock.json"), LOCK + " ");
                    return res(1);
                },
                log: (l) => logs.push(l),
            }),
            BastionError,
        );
        assert.deepEqual(logs, ["+ x"]);
        assert.ok(!existsSync(join(dir, "build", ".lock-before.json")));
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test("pakku failure without lock change errors without diff", async () => {
    const dir = fixture();
    const calls: string[] = [];
    try {
        await assert.rejects(
            changeMods(dir, "rm", ["x"], {
                pakku: async (a) => (calls.push(a[0]!), res(1)),
                log: () => {},
            }),
            BastionError,
        );
        assert.deepEqual(calls, ["rm"]);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
