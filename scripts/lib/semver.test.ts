import assert from "node:assert/strict";
import { test } from "node:test";
import { compareSemver, isPrerelease, isSemver, previousReleaseTag } from "./semver.ts";

test("isSemver accepts plain and prerelease, rejects v prefix", () => {
    assert.ok(isSemver("1.2.3"));
    assert.ok(isSemver("1.0.0-beta.1"));
    assert.ok(!isSemver("v1.2.3"));
    assert.ok(!isSemver("1.3.3x"));
    assert.ok(!isSemver("1.2"));
});
test("isPrerelease", () => {
    assert.ok(isPrerelease("1.0.0-rc.1"));
    assert.ok(!isPrerelease("1.0.0"));
});
test("previousReleaseTag ignores non-semver tags", () =>
    assert.equal(
        previousReleaseTag(["v0.1.0", "latest", "1.3.3x", "0.1.0", "0.2.0"], "0.3.0"),
        "0.2.0",
    ));
test("previousReleaseTag with no tags", () => assert.equal(previousReleaseTag([], "0.1.0"), null));
test("previousReleaseTag without current returns the greatest", () =>
    assert.equal(previousReleaseTag(["0.1.0", "0.10.0", "0.9.0"]), "0.10.0"));
test("previousReleaseTag is strictly below current", () =>
    assert.equal(previousReleaseTag(["0.1.0", "0.2.0"], "0.2.0"), "0.1.0"));
test("prerelease sorts before release", () =>
    assert.ok(compareSemver("1.0.0-beta.1", "1.0.0") < 0));
test("numeric prerelease identifiers compare numerically", () =>
    assert.ok(compareSemver("1.0.0-beta.2", "1.0.0-beta.10") < 0));
test("compareSemver compares numerically, not lexically", () =>
    assert.ok(compareSemver("0.10.0", "0.9.0") > 0));
