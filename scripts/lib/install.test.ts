import assert from "node:assert/strict";
import { test } from "node:test";
import { BastionError } from "./errors.ts";
import { installDependencies } from "./install.ts";

test("installDependencies runs a frozen pnpm install in the repo root", async () => {
    const seen: unknown[] = [];
    await installDependencies("/repo", async (cmd, args, opts) => {
        seen.push([cmd, args, opts]);
        return { code: 0, stdout: "", stderr: "" };
    });
    assert.deepEqual(seen, [
        ["pnpm", ["install", "--frozen-lockfile"], { cwd: "/repo", inherit: true }],
    ]);
});

test("installDependencies maps a failure to a BastionError linking #pnpm-install", async () => {
    await assert.rejects(
        installDependencies("/repo", async () => ({ code: 1, stdout: "", stderr: "" })),
        (e: unknown) => e instanceof BastionError && e.docs?.endsWith("#pnpm-install") === true,
    );
});
