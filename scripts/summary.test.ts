import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lockDiffSince, renderSummary, safeLockDiff } from "./summary.ts";
import { BastionError } from "./lib/errors.ts";

const base = {
    name: "BastionPack",
    version: "1.4.0+dev.abc1234",
    mc: "1.21.1",
    loader: "neoforge",
};
const res = (code: number, stdout = "", stderr = "") => ({ code, stdout, stderr });

test("first build line when diff is null", () => {
    const md = renderSummary({ ...base, modCount: 3, diff: null });
    assert.match(md, /No previous release tag — this is the first build\./);
});

test("includes pack facts and mod count", () => {
    const md = renderSummary({ ...base, modCount: 42, diff: null });
    assert.match(md, /BastionPack/);
    assert.match(md, /1\.4\.0\+dev\.abc1234/);
    assert.match(md, /1\.21\.1/);
    assert.match(md, /neoforge/);
    assert.match(md, /\b42\b/);
});

test("renders the diff when present", () => {
    const md = renderSummary({ ...base, modCount: 1, diff: "### Added\n- jei" });
    assert.match(md, /### Added\n- jei/);
    assert.doesNotMatch(md, /first build/);
});

function fixture(): string {
    const dir = mkdtempSync(join(tmpdir(), "bp-summary-"));
    writeFileSync(join(dir, "pakku-lock.json"), "{}");
    return dir;
}

test("lockDiffSince returns null without a previous tag", async () => {
    const dir = fixture();
    try {
        const git = async () => {
            throw new Error("must not run");
        };
        assert.equal(await lockDiffSince(null, dir, { git, pakku: git }), null);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test("lockDiffSince reads pakku's markdown file and cleans up", async () => {
    const dir = fixture();
    try {
        let gitArgs: string[] = [];
        const out = await lockDiffSince("1.0.0", dir, {
            git: async (a) => {
                gitArgs = a;
                return res(0, '{"old":true}');
            },
            pakku: async (a) => {
                assert.equal(a[0], "diff");
                const flag = a.find((x) => x.startsWith("--markdown="))!;
                writeFileSync(flag.slice("--markdown=".length), "## Added\n- jei");
                assert.ok(a.at(-1)!.endsWith("pakku-lock.json"));
                return res(0);
            },
        });
        assert.deepEqual(gitArgs, ["show", "1.0.0:pakku-lock.json"]);
        assert.equal(out, "## Added\n- jei");
        const build = join(dir, "build");
        assert.deepEqual(existsSync(build) ? readdirSync(build) : [], []);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test("lockDiffSince returns a note when the old tag has no lock", async () => {
    const dir = fixture();
    try {
        const out = await lockDiffSince("0.1.0", dir, {
            git: async () => res(128, "", "fatal: path does not exist"),
            pakku: async () => res(0),
        });
        assert.match(out!, /0\.1\.0/);
        assert.match(out!, /pakku-lock\.json/);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test("lockDiffSince reports no changes when pakku writes nothing", async () => {
    const dir = fixture();
    try {
        const out = await lockDiffSince("1.0.0", dir, {
            git: async () => res(0, "{}"),
            pakku: async () => res(0),
        });
        assert.match(out!, /No mod changes since 1\.0\.0/);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test("lockDiffSince pakku failure -> BastionError and temp files removed", async () => {
    const dir = fixture();
    try {
        mkdirSync(join(dir, "build"));
        await assert.rejects(
            lockDiffSince("1.0.0", dir, {
                git: async () => res(0, "{}"),
                pakku: async () => res(1, "", "boom"),
            }),
            (e: BastionError) => e instanceof BastionError && /summary-diff-failed/.test(e.docs!),
        );
        assert.deepEqual(readdirSync(join(dir, "build")), []);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test("safeLockDiff turns a failure into a warning and a note", async () => {
    const warnings: string[] = [];
    const out = await safeLockDiff(
        "1.0.0",
        "x",
        async () => {
            throw new BastionError("pakku diff failed (exit 1)");
        },
        (m) => warnings.push(m),
    );
    assert.equal(out, "Mod diff unavailable: pakku diff failed (exit 1)");
    assert.deepEqual(warnings, [out]);
    const md = renderSummary({ ...base, modCount: 1, diff: out });
    assert.match(md, /Mod diff unavailable: pakku diff failed/);
});

test("safeLockDiff passes results through", async () => {
    assert.equal(
        await safeLockDiff(
            null,
            "x",
            async () => null,
            () => {},
        ),
        null,
    );
});
