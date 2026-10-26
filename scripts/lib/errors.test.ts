import assert from "node:assert/strict";
import { test } from "node:test";
import { BastionError, formatError } from "./errors.ts";
import { run } from "./exec.ts";

test("formatError prints message, hint and docs", () => {
    const e = new BastionError("pakku.jar not found", {
        hint: "run `task setup`",
        docs: "docs/troubleshooting.md#pakku-missing",
    });
    assert.equal(
        formatError(e),
        "✖ pakku.jar not found\n  → run `task setup`\n  docs: docs/troubleshooting.md#pakku-missing",
    );
});

test("formatError on plain Error prints only the message", () => {
    assert.equal(formatError(new Error("boom")), "✖ boom");
});

test("run returns non-zero code instead of throwing", async () => {
    const r = await run(process.execPath, ["-e", "process.exit(3)"]);
    assert.equal(r.code, 3);
});

test("run on missing binary throws BastionError with install hint", async () => {
    await assert.rejects(
        run("definitely-not-a-binary-xyz", []),
        (e) => e instanceof BastionError && /mise install/.test(e.hint ?? ""),
    );
});
