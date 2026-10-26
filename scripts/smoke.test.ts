import assert from "node:assert/strict";
import { test } from "node:test";
import {
    attempt,
    failureContext,
    isReadyLine,
    isTransientInstallerError,
    removeOnSignal,
} from "./smoke.ts";

test("isReadyLine matches the NeoForge ready line", () => {
    assert.equal(
        isReadyLine(
            '[23Oct2026 10:00:01.123] [Server thread/INFO] [minecraft/DedicatedServer]: Done (7.516s)! For help, type "help"',
        ),
        true,
    );
});

test("isReadyLine rejects other progress lines", () => {
    assert.equal(
        isReadyLine("[Server thread/INFO] [minecraft/MinecraftServer]: Done preparing level"),
        false,
    );
    assert.equal(isReadyLine(""), false);
});

test("failureContext keeps only the last N lines", () => {
    const log = Array.from({ length: 100 }, (_, i) => `line ${i}`).join("\n");
    const out = failureContext(log, 10);
    assert.match(out, /line 99/);
    assert.match(out, /line 90/);
    assert.doesNotMatch(out, /line 89\b/);
});

test("failureContext defaults to 60 lines", () => {
    const log = Array.from({ length: 100 }, (_, i) => `line ${i}`).join("\n");
    const out = failureContext(log);
    assert.match(out, /line 40\b/);
    assert.doesNotMatch(out, /line 39\b/);
});

test("failureContext extracts crash report paths", () => {
    const log = [
        "early line",
        "#@!@# Game crashed! Crash report saved to: #@!@# /data/crash-reports/crash-2026-10-23_10.00.00-server.txt",
        ...Array.from({ length: 80 }, (_, i) => `filler ${i}`),
    ].join("\n");
    const out = failureContext(log, 5);
    assert.match(
        out,
        /Crash report: \/data\/crash-reports\/crash-2026-10-23_10\.00\.00-server\.txt/,
    );
});

test("isTransientInstallerError spots installer network failures only", () => {
    assert.equal(isTransientInstallerError("java.net.ConnectException: Connection refused"), true);
    assert.equal(
        isTransientInstallerError("Mod create requires neoforge 21.1.219 or above"),
        false,
    );
});

const okRes = { code: 0, stdout: "", stderr: "" };

test("removeOnSignal removes the container and exits with the signal code", () => {
    const before = process.listeners("SIGINT").length;
    const removed: string[] = [];
    const codes: number[] = [];
    const dispose = removeOnSignal(
        "c1",
        (c) => codes.push(c),
        (n) => removed.push(n),
    );
    (process.listeners("SIGINT").at(-1) as () => void)();
    (process.listeners("SIGTERM").at(-1) as () => void)();
    assert.deepEqual(removed, ["c1", "c1"]);
    assert.deepEqual(codes, [130, 143]);
    dispose();
    assert.equal(process.listeners("SIGINT").length, before);
});

test("attempt removes the container when docker run fails, and drops its handlers", async () => {
    const before = process.listeners("SIGINT").length;
    const calls: string[][] = [];
    const dock = async (args: string[]) => {
        calls.push(args);
        return args[0] === "run" ? { code: 125, stdout: "", stderr: "port in use" } : okRes;
    };
    await assert.rejects(
        attempt({ mrpack: "x.mrpack", image: "img", deadline: Date.now() + 1000 }, dock),
        /docker run failed/,
    );
    assert.deepEqual(calls.at(-1)?.slice(0, 2), ["rm", "-fv"]);
    assert.equal(process.listeners("SIGINT").length, before);
});

test("attempt does not mask the outcome when docker rm throws", async () => {
    const dock = async (args: string[]) => {
        if (args[0] === "rm") throw new Error("daemon gone");
        if (args[0] === "logs") return { ...okRes, stdout: 'Done (1.0s)! For help, type "help"' };
        return okRes;
    };
    const r = await attempt(
        { mrpack: "x.mrpack", image: "img", deadline: Date.now() + 1000 },
        dock,
    );
    assert.deepEqual(r, { ok: true });
});
