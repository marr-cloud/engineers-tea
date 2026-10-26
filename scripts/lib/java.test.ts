import assert from "node:assert/strict";
import { test } from "node:test";
import { parseJavaMajor } from "./java.ts";

test("modern openjdk version string", () => {
    assert.equal(parseJavaMajor('openjdk version "21.0.12.1" 2025-01-21'), 21);
});
test("legacy 1.x scheme maps to x", () => {
    assert.equal(parseJavaMajor('java version "1.8.0_392"'), 8);
});
test("bare major", () => {
    assert.equal(parseJavaMajor('"17"'), 17);
    assert.equal(parseJavaMajor("17"), 17);
    assert.equal(parseJavaMajor('openjdk version "17" 2021-09-14'), 17);
});
test("garbage is null", () => {
    assert.equal(parseJavaMajor("command not found"), null);
    assert.equal(parseJavaMajor(""), null);
});
