import assert from "node:assert/strict";
import { test } from "node:test";
import { devVersion } from "./version.ts";

test("devVersion without tags", () =>
    assert.equal(devVersion({ lastTag: null, sha: "abcdef1234" }), "0.0.0+dev.abcdef1"));
test("devVersion after a release", () =>
    assert.equal(devVersion({ lastTag: "0.2.0", sha: "abcdef1234" }), "0.2.0+dev.abcdef1"));
