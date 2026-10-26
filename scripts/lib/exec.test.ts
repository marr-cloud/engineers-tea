import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { run } from "./exec.ts";

const win = { skip: process.platform !== "win32" };

test("run merges opts.env with the parent environment", async () => {
    const r = await run(process.execPath, ["-p", "process.env.FOO + '|' + process.env.PATH"], {
        env: { FOO: "1" },
    });
    const [foo, path] = r.stdout.trim().split("|");
    assert.equal(foo, "1");
    assert.ok(path && path.length > 0);
});

test("run executes .cmd shims on Windows", win, async () => {
    const r = await run("npm", ["--version"]);
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout.trim(), /^\d+\.\d+\.\d+/);
});

test("run round-trips awkward arguments through a .cmd shim", win, async () => {
    const dir = mkdtempSync(join(tmpdir(), "bastion-exec-"));
    try {
        writeFileSync(join(dir, "p.js"), "console.log(JSON.stringify(process.argv.slice(2)));");
        writeFileSync(join(dir, "shim.cmd"), `@"${process.execPath}" "%~dp0p.js" %*\r\n`);
        const args = ["a b", 'say "hi"', "x&y|z", "100%", "trailing\\", "(p)^"];
        const r = await run(join(dir, "shim.cmd"), args);
        assert.equal(r.code, 0, r.stderr);
        assert.deepEqual(JSON.parse(r.stdout), args);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
