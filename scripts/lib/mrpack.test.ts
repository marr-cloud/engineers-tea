import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { strToU8, zipSync } from "fflate";
import { BastionError } from "./errors.ts";
import { listOverrides, readMrpackIndex } from "./mrpack.ts";

const dir = mkdtempSync(join(tmpdir(), "mrpack-test-"));
after(() => rmSync(dir, { recursive: true, force: true }));

const index = {
    formatVersion: 1,
    name: "T",
    versionId: "1.0.0",
    dependencies: { minecraft: "1.21.1", neoforge: "21.1.1" },
    files: [],
};
const good = join(dir, "good.mrpack");
writeFileSync(
    good,
    zipSync({
        "modrinth.index.json": strToU8(JSON.stringify(index)),
        "overrides/config/a.toml": strToU8("a"),
        "client-overrides/options.txt": strToU8("b"),
        "server-overrides/server.properties": strToU8("c"),
        "other/ignored.txt": strToU8("d"),
    }),
);

test("readMrpackIndex reads dependencies", async () => {
    const i = await readMrpackIndex(good);
    assert.equal(i.dependencies.minecraft, "1.21.1");
    assert.equal(i.versionId, "1.0.0");
});
test("listOverrides lists the three override trees", async () => {
    assert.deepEqual((await listOverrides(good)).sort(), [
        "client-overrides/options.txt",
        "overrides/config/a.toml",
        "server-overrides/server.properties",
    ]);
});
test("readMrpackIndex rejects a pack without an index", async () => {
    const bad = join(dir, "bad.mrpack");
    writeFileSync(bad, zipSync({ "x.txt": strToU8("x") }));
    await assert.rejects(readMrpackIndex(bad), BastionError);
});
test("readMrpackIndex rejects a non-zip file", async () => {
    const bad = join(dir, "notzip.mrpack");
    writeFileSync(bad, "nope");
    await assert.rejects(readMrpackIndex(bad), BastionError);
});
