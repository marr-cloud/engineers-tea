import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import type { PakkuLock } from "./lib/lock.ts";
import {
    checkInstanceLayout,
    mergeInstanceCfg,
    mmcPackMatches,
    parseMode,
    qtIniValue,
    renderInstanceCfg,
    renderMmcPack,
    writeInstanceFiles,
} from "./prism.ts";

const lock: PakkuLock = {
    target: "modrinth",
    mc_versions: ["1.21.1"],
    loaders: { neoforge: "21.1.264" },
    projects: [],
};

let base: string;
beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), "prism-test-"));
});
afterEach(() => rmSync(base, { recursive: true, force: true }));

test("layout ok for a fresh instance with apostrophe and spaces", () => {
    const mc = join(base, "instances", "Engineer's Tea", "minecraft");
    mkdirSync(mc, { recursive: true });
    const r = checkInstanceLayout(mc);
    assert.deepEqual(r, { ok: true, instanceDir: join(base, "instances", "Engineer's Tea") });
});

test("layout ok when the parent has instance.cfg, even outside instances/", () => {
    const mc = join(base, "Some Name", "Odd Place", "minecraft");
    mkdirSync(mc, { recursive: true });
    writeFileSync(join(base, "Some Name", "Odd Place", "instance.cfg"), "[General]\n");
    assert.equal(checkInstanceLayout(mc).ok, true);
});

test("layout ok for .minecraft", () => {
    const mc = join(base, "instances", "X", ".minecraft");
    mkdirSync(mc, { recursive: true });
    assert.equal(checkInstanceLayout(mc).ok, true);
});

test("layout rejected outside Prism, reason names the expected layout", () => {
    const dir = join(base, "workspace", "js", "PanPack");
    mkdirSync(dir, { recursive: true });
    const r = checkInstanceLayout(dir);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.reason, /instances\/<name>\/minecraft/);
});

test("layout rejected when minecraft sits in instances/ but is not under a named instance", () => {
    const mc = join(base, "minecraft");
    mkdirSync(mc);
    assert.equal(checkInstanceLayout(mc).ok, false);
});

test("renderMmcPack uses net.neoforged and lock versions", () => {
    const pack = renderMmcPack(lock) as {
        formatVersion: number;
        components: { uid: string; version: string }[];
    };
    assert.equal(pack.formatVersion, 1);
    const by = Object.fromEntries(pack.components.map((c) => [c.uid, c.version]));
    assert.deepEqual(by, {
        "org.lwjgl3": "3.3.3",
        "net.minecraft": "1.21.1",
        "net.neoforged": "21.1.264",
    });
});

test("renderInstanceCfg has name and prelaunch command", () => {
    const cfg = renderInstanceCfg("Engineer's Tea");
    assert.match(cfg, /^\[General\]\r?\n/);
    assert.match(cfg, /^name=Engineer's Tea$/m);
    assert.match(cfg, /^InstanceType=OneSix$/m);
    assert.match(cfg, /^OverrideCommands=true$/m);
    assert.match(
        cfg,
        /^PreLaunchCommand=\\"\$INST_JAVA\\" -jar \\"\$INST_MC_DIR\/pakku\.jar\\" --working-path \\"\$INST_MC_DIR\\" fetch$/m,
    );
});

test("renderInstanceCfg rejects names that would break the file", () => {
    assert.throws(() => renderInstanceCfg("a\nb"), { name: "BastionError" });
});

test("writeInstanceFiles writes both files; sync-only writes just mmc-pack", () => {
    const inst = join(base, "Some Name", "it's");
    mkdirSync(inst, { recursive: true });
    writeInstanceFiles(inst, lock, "BastionPack", { cfg: true });
    assert.equal(mmcPackMatches(inst, lock), true);
    rmSync(join(inst, "instance.cfg"));
    writeInstanceFiles(inst, { ...lock, loaders: { neoforge: "21.1.300" } }, "BastionPack", {
        cfg: false,
    });
    assert.equal(mmcPackMatches(inst, lock), false);
    assert.equal(existsSync(join(inst, "instance.cfg")), false);
});

test("mmcPackMatches false when missing or malformed", () => {
    assert.equal(mmcPackMatches(join(base, "nope"), lock), false);
    writeFileSync(join(base, "mmc-pack.json"), "{not json");
    assert.equal(mmcPackMatches(base, lock), false);
});

test("existing instance.cfg is merged, not overwritten", () => {
    const inst = join(base, "inst");
    mkdirSync(inst);
    writeFileSync(
        join(inst, "instance.cfg"),
        "[General]\nname=My Custom Name\nMaxMemAlloc=6144\nPreLaunchCommand=java -jar pakku.jar fetch\nPreLaunchCommand=dup\nnotes=hi\n",
    );
    writeInstanceFiles(inst, lock, "BastionPack", { cfg: true });
    const out = readFileSync(join(inst, "instance.cfg"), "utf8");
    assert.match(out, /^name=My Custom Name$/m);
    assert.match(out, /^MaxMemAlloc=6144$/m);
    assert.match(out, /^notes=hi$/m);
    assert.equal(out.match(/^PreLaunchCommand=/gm)?.length, 1);
    assert.match(out, /^PreLaunchCommand=\\"\$INST_JAVA\\" -jar \\"\$INST_MC_DIR\/pakku\.jar\\"/m);
    assert.equal(out.match(/^InstanceType=/gm)?.length, 1);
    assert.equal(out.match(/^OverrideCommands=true$/gm)?.length, 1);
    assert.equal(out.match(/^name=/gm)?.length, 1);
});

test("merge keeps other sections and CRLF", () => {
    const out = mergeInstanceCfg("[General]\r\nOverrideCommands=false\r\n[Other]\r\nx=1\r\n", "N");
    assert.match(out, /OverrideCommands=true\r\n/);
    assert.match(out, /InstanceType=OneSix\r\n\[Other\]\r\nx=1\r\n$/);
});

test("parseMode accepts setup/sync only", () => {
    assert.equal(parseMode("sync"), "sync");
    assert.throws(() => parseMode(undefined), { name: "BastionError" });
    assert.throws(() => parseMode("wipe"), /setup, sync/);
});

// Prism reads instance.cfg with Qt's QSettings: a bare '"' starts a quoted span and the
// spaces around it are dropped, which glued the PreLaunchCommand arguments together.
test("qtIniValue escapes quotes and backslashes like QSettings", () => {
    assert.equal(
        qtIniValue(String.raw`"$INST_JAVA" -jar "$INST_MC_DIR/pakku.jar" fetch`),
        String.raw`\"$INST_JAVA\" -jar \"$INST_MC_DIR/pakku.jar\" fetch`,
    );
    assert.equal(qtIniValue(String.raw`C:\Games\x`), String.raw`C:\\Games\\x`);
    assert.equal(qtIniValue("Engineer's Tea"), "Engineer's Tea");
});

test("qtIniValue quotes values QSettings would split or trim", () => {
    assert.equal(qtIniValue("Tea, Cake"), '"Tea, Cake"');
    assert.equal(qtIniValue("a;b"), '"a;b"');
    assert.equal(qtIniValue("a=b"), '"a=b"');
    assert.equal(qtIniValue(" padded "), '" padded "');
});

test("renderInstanceCfg escapes the pack name", () => {
    assert.match(renderInstanceCfg('Tea, "Deluxe"'), /^name="Tea, \\"Deluxe\\""$/m);
});
