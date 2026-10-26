import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { run } from "./lib/exec.ts";
import { parseReleaseArgs, release } from "./release.ts";

const g = (cwd: string, ...args: string[]) =>
    execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

function fixture() {
    const base = mkdtempSync(join(tmpdir(), "bastion-release-"));
    const origin = join(base, "origin.git");
    const work = join(base, "work");
    execFileSync("git", ["init", "--bare", "-b", "main", origin]);
    execFileSync("git", ["init", "-b", "main", work]);
    g(work, "config", "user.email", "t@example.com");
    g(work, "config", "user.name", "t");
    g(work, "config", "commit.gpgsign", "false");
    g(work, "remote", "add", "origin", origin);
    writeFileSync(join(work, "CHANGELOG.md"), "# Changelog\n\n## [Unreleased]\n\n- thing\n");
    g(work, "add", ".");
    g(work, "commit", "-m", "init");
    return { origin, work };
}

test("release commits, tags and pushes atomically", async () => {
    const { origin, work } = fixture();
    await release(work, "0.1.0", run, "2026-10-23");
    assert.equal(g(work, "log", "-1", "--format=%s"), "chore: release 0.1.0");
    assert.match(readFileSync(join(work, "CHANGELOG.md"), "utf8"), /## \[0\.1\.0\] - 2026-10-23/);
    assert.equal(g(origin, "tag", "--list"), "0.1.0");
    assert.equal(g(origin, "rev-parse", "main"), g(work, "rev-parse", "HEAD"));
});

test("release refuses on a dirty tree without touching anything", async () => {
    const { work } = fixture();
    writeFileSync(join(work, "stray.txt"), "x");
    const before = g(work, "rev-parse", "HEAD");
    await assert.rejects(release(work, "0.1.0"), /uncommitted/);
    assert.equal(g(work, "rev-parse", "HEAD"), before);
    assert.equal(g(work, "tag", "--list"), "");
});

test("release refuses off main", async () => {
    const { work } = fixture();
    g(work, "switch", "-c", "dev");
    await assert.rejects(release(work, "0.1.0"), /main/);
});

function pushMain(work: string) {
    g(work, "push", "origin", "main");
}

function otherClone(origin: string, base: string) {
    const other = join(base, "other");
    execFileSync("git", ["clone", origin, other]);
    g(other, "config", "user.email", "t@example.com");
    g(other, "config", "user.name", "t");
    g(other, "config", "commit.gpgsign", "false");
    return other;
}

test("release refuses when origin/main is ahead, before any write", async () => {
    const { origin, work } = fixture();
    pushMain(work);
    const other = otherClone(origin, join(origin, ".."));
    writeFileSync(join(other, "x.txt"), "x");
    g(other, "add", ".");
    g(other, "commit", "-m", "remote work");
    g(other, "push", "origin", "main");
    const before = readFileSync(join(work, "CHANGELOG.md"), "utf8");
    await assert.rejects(release(work, "0.1.0"), /behind or diverged/);
    assert.equal(readFileSync(join(work, "CHANGELOG.md"), "utf8"), before);
    assert.equal(g(work, "tag", "--list"), "");
});

test("release refuses a tag that exists only on origin", async () => {
    const { work } = fixture();
    pushMain(work);
    g(work, "tag", "0.1.0");
    g(work, "push", "origin", "0.1.0");
    g(work, "tag", "-d", "0.1.0");
    await assert.rejects(release(work, "0.1.0"), /already exists/);
});

test("release explains recovery when the push is rejected", async () => {
    const { origin, work } = fixture();
    pushMain(work);
    const other = otherClone(origin, join(origin, ".."));
    writeFileSync(join(other, "x.txt"), "x");
    g(other, "add", ".");
    g(other, "commit", "-m", "remote work");
    g(other, "push", "origin", "main");
    // Simulate a race: the fetch does not see the new remote commit.
    const stale: typeof run = (cmd, args, opts) =>
        args[0] === "fetch"
            ? Promise.resolve({ code: 0, stdout: "", stderr: "" })
            : run(cmd, args, opts);
    await assert.rejects(release(work, "0.1.0", stale, "2026-10-23"), (e: unknown) => {
        const err = e as { message: string; hint: string; docs: string };
        assert.match(err.hint, /git push --atomic origin main 0\.1\.0/);
        assert.match(err.hint, /git tag -d 0\.1\.0/);
        assert.match(err.hint, /git reset --hard HEAD~1/);
        assert.match(err.message, /rejected|failed/);
        assert.match(err.docs, /#release-git-failed/);
        return true;
    });
});

test("release explains recovery when the commit fails", async () => {
    const { work } = fixture();
    const failing: typeof run = (cmd, args, opts) =>
        args[0] === "commit"
            ? Promise.resolve({ code: 1, stdout: "", stderr: "hook said no" })
            : run(cmd, args, opts);
    await assert.rejects(release(work, "0.1.0", failing), (e: unknown) => {
        const err = e as { message: string; hint: string };
        assert.match(err.message, /hook said no/);
        assert.match(err.hint, /git restore --staged --worktree CHANGELOG\.md/);
        return true;
    });
});

test("parseReleaseArgs accepts exactly one version and rejects extra arguments", () => {
    assert.equal(parseReleaseArgs(["0.2.0"]), "0.2.0");
    assert.throws(() => parseReleaseArgs([]), /Missing version/);
    assert.throws(() => parseReleaseArgs(["0.2.0", "--dry-run"]), /Unknown argument: --dry-run/);
});
