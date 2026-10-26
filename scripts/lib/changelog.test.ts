import assert from "node:assert/strict";
import { test } from "node:test";
import { extractSection, promoteUnreleased, validateRelease } from "./changelog.ts";

const md = `# Changelog

intro

## [Unreleased]

### Added

- a mod

## [0.1.0] - 2026-01-01

- first
`;
const emptyMd = "# Changelog\n\n## [Unreleased]\n";
const ok = {
    version: "0.2.0",
    branch: "main",
    clean: true,
    tags: ["0.1.0"],
    changelog: md,
};

test("extractSection is case-insensitive for Unreleased and trims", () => {
    assert.equal(extractSection(md, "unreleased"), "### Added\n\n- a mod");
    assert.equal(extractSection(md, "0.1.0"), "- first");
    assert.equal(extractSection(md, "9.9.9"), null);
});
test("promoteUnreleased moves entries", () => {
    const out = promoteUnreleased(md, "0.2.0", "2026-10-23");
    assert.match(
        out,
        /## \[Unreleased\]\n\n## \[0\.2\.0\] - 2026-10-23\n\n### Added\n\n- a mod\n\n## \[0\.1\.0\]/,
    );
    assert.equal(extractSection(out, "Unreleased"), "");
    assert.equal(extractSection(out, "0.2.0"), "### Added\n\n- a mod");
});
test("promoteUnreleased works when Unreleased is the last section", () => {
    const out = promoteUnreleased("# C\n\n## [Unreleased]\n\n- x\n", "1.0.0", "2026-10-23");
    assert.equal(out, "# C\n\n## [Unreleased]\n\n## [1.0.0] - 2026-10-23\n\n- x\n");
});
test("promoteUnreleased refuses empty Unreleased", () =>
    assert.throws(() => promoteUnreleased(emptyMd, "0.2.0", "2026-10-23"), /Unreleased/));
test("promoteUnreleased refuses an existing version", () =>
    assert.throws(() => promoteUnreleased(md, "0.1.0", "2026-10-23"), /already/));
test("validateRelease accepts a good release", () => validateRelease(ok));
test("validateRelease rejects non-semver", () => {
    assert.throws(() => validateRelease({ ...ok, version: "v0.2.0" }), /not a valid version/);
    assert.throws(() => validateRelease({ ...ok, version: "latest" }), /not a valid version/);
});
test("validateRelease rejects a dirty tree", () =>
    assert.throws(() => validateRelease({ ...ok, clean: false }), /uncommitted/));
test("validateRelease rejects non-main branch", () =>
    assert.throws(() => validateRelease({ ...ok, branch: "dev" }), /main/));
test("validateRelease rejects an existing tag", () =>
    assert.throws(() => validateRelease({ ...ok, tags: ["0.2.0"] }), /exists/));
test("validateRelease rejects version not above previous", () =>
    assert.throws(() => validateRelease({ ...ok, version: "0.1.0", tags: ["0.2.0"] }), /greater/));
test("validateRelease ignores non-semver tags and allows the first release", () => {
    validateRelease({ ...ok, version: "0.1.0", tags: ["v0.5.0", "latest", "1.3.3x"] });
    validateRelease({ ...ok, version: "0.1.0", tags: [] });
});
test("validateRelease rejects empty Unreleased", () =>
    assert.throws(() => validateRelease({ ...ok, changelog: emptyMd }), /Unreleased/));
test("BastionErrors carry docs anchors", () => {
    try {
        validateRelease({ ...ok, clean: false });
        assert.fail();
    } catch (e) {
        assert.match((e as { docs: string }).docs, /troubleshooting\.md#release-dirty-tree/);
    }
});
