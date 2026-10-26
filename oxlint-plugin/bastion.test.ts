import assert from "node:assert/strict";
import { test } from "node:test";
import { run } from "../scripts/lib/exec.ts";
import { repoRoot } from "../scripts/lib/paths.ts";

const lint = (file: string) =>
    run("pnpm", ["exec", "oxlint", "-c", ".oxlintrc.json", file], { cwd: repoRoot() });

test("no-empty-recipe-remove reports event.remove({})", async () => {
    const r = await lint("oxlint-plugin/fixtures/empty-remove.js");
    assert.notEqual(r.code, 0);
    assert.match(r.stdout, /no-empty-recipe-remove/);
});

test("no-empty-recipe-remove accepts a filtered remove", async () => {
    const r = await lint("oxlint-plugin/fixtures/filtered-remove.js");
    assert.equal(r.code, 0, r.stdout + r.stderr);
});
