import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { findBrokenLinks, findMissingAnchors, findUnknownTasks, slugify } from "./check-docs.ts";

function fixture(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), "check-docs-"));
    for (const [rel, text] of Object.entries(files)) {
        const p = join(root, rel);
        mkdirSync(dirname(p), { recursive: true });
        writeFileSync(p, text);
    }
    return root;
}

test("slugify follows GitHub rules", () => {
    assert.equal(slugify("Java 21 not found!"), "java-21-not-found");
    assert.equal(slugify("`task doctor` fails: why?"), "task-doctor-fails-why");
});

test("findBrokenLinks reports missing files and anchors, ignores external and code", () => {
    const root = fixture({
        "README.md":
            "# Title\n[ok](docs/a.md)\n[bad](docs/nope.md)\n[ext](https://x.dev/y)\n" +
            "[anchor](docs/a.md#real-heading)\n[badanchor](docs/a.md#missing)\n[self](#title)\n[badself](#zzz)\n" +
            "```\n[in code](nope.md)\n```\n",
        "docs/a.md": "# A\n## Real heading\n",
    });
    const broken = findBrokenLinks(root, ["README.md", "docs/a.md"]);
    assert.deepEqual(broken.map((b) => b.link).sort(), [
        "#zzz",
        "docs/a.md#missing",
        "docs/nope.md",
    ]);
    assert.ok(broken.every((b) => b.file === "README.md"));
});

test("findUnknownTasks finds task mentions that do not exist", () => {
    const text = "Run `task setup` then `task foo`, `task mods:add -- x`, `task --list`.";
    assert.deepEqual(findUnknownTasks(text, ["setup", "mods:add"]), ["foo"]);
});

test("findMissingAnchors covers literal, constant and workflow references", () => {
    const root = fixture({
        "docs/troubleshooting.md": "# T\n## Pakku missing\n## Ci anchor\n",
        "docs/guides/there.md": "# G\n",
        "scripts/a.ts":
            'const D = "docs/troubleshooting.md";\n' +
            "x(`${D}#pakku-missing`); y(`${D}#gone`);\n" +
            'z("docs/troubleshooting.md#nowhere"); see("docs/guides/there.md"); see("docs/guides/absent.md");\n',
        "scripts/a.test.ts": 'w("docs/troubleshooting.md#from-test");',
        ".github/workflows/ci.yml":
            "run: echo docs/troubleshooting.md#ci-anchor docs/troubleshooting.md#ci-gone\n",
    });
    assert.deepEqual(findMissingAnchors(root, []), [
        "docs/guides/absent.md",
        "docs/troubleshooting.md#ci-gone",
        "docs/troubleshooting.md#gone",
        "docs/troubleshooting.md#nowhere",
    ]);
    assert.deepEqual(
        findMissingAnchors(root, ["extra-needed"]).includes("docs/troubleshooting.md#extra-needed"),
        true,
    );
});

test("findMissingAnchors flags dynamic anchors and bare docs values", () => {
    const root = fixture({
        "docs/troubleshooting.md": "# T\n",
        "scripts/a.ts":
            'const D = "docs/troubleshooting.md";\nx(`${D}#${name}`);\ny(`docs/troubleshooting.md#${n}`);\n',
        "scripts/b.ts": 'throw new E("m", { docs: "modrinth-x" });\n',
        "scripts/c.ts": 'throw new E("m", { docs: "docs/troubleshooting.md#c-ok" });\n',
    });
    const out = findMissingAnchors(root);
    assert.ok(
        out.includes("scripts/a.ts: dynamic anchor, use a literal anchor so it can be checked"),
    );
    assert.ok(out.some((m) => m.startsWith("scripts/b.ts: bare docs value")));
    assert.ok(!out.some((m) => m.startsWith("scripts/c.ts")));
});
