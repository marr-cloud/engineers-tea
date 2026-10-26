import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

// Node realpaths the main module, so entry guards must not compare against argv[1].
test("scripts still run when the repo is reached through a symlink or junction", () => {
    const root = resolve(import.meta.dirname, "..");
    const dir = mkdtempSync(join(tmpdir(), "bastion-link-"));
    const link = join(dir, "repo");
    try {
        symlinkSync(root, link, "junction");
    } catch {
        rmSync(dir, { recursive: true, force: true });
        return; // cannot create links here; nothing to assert
    }
    try {
        const r = spawnSync(process.execPath, [join(link, "scripts", "release.ts")], {
            cwd: root,
            encoding: "utf8",
        });
        assert.notEqual(r.status, 0, "release without a version must fail");
        assert.match(r.stderr + r.stdout, /version/i);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
