import assert from "node:assert/strict";
import { test } from "node:test";
import { buildReleaseNotes } from "./release-notes.ts";

test("puts the changelog section first, then the mod changes", () => {
    const md = buildReleaseNotes({
        changelogSection: "### Added\n- New quest",
        diffMarkdown: "#### Added\n- Create",
    });
    assert.equal(md, "### Added\n- New quest\n\n## Mod changes\n\n#### Added\n- Create\n");
});

test("says so on the first release (no diff)", () => {
    const md = buildReleaseNotes({ changelogSection: "Initial release.", diffMarkdown: null });
    assert.equal(
        md,
        "Initial release.\n\n## Mod changes\n\nFirst release — no previous version to compare.\n",
    );
});

test("falls back when the changelog section is empty", () => {
    const md = buildReleaseNotes({ changelogSection: "  ", diffMarkdown: null });
    assert.match(md, /^No changelog entry for this release\./);
});
