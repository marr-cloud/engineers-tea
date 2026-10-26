import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { downloadVerified, type DownloadVerifiedOptions } from "./download.ts";
import { BastionError } from "./errors.ts";

const bytes = Buffer.from("fake jar contents");
const sha = createHash("sha256").update(bytes).digest("hex");
let dir: string;
let calls: string[];
let opts: DownloadVerifiedOptions;

beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "download-test-"));
    calls = [];
    opts = {
        url: "https://example.test/x.jar",
        dest: join(dir, "x.jar"),
        sha256: sha,
        label: "Thing",
        fileName: "x.jar",
        retryHint: "retry",
        checksumHint: "bad hash",
        downloadDocs: "docs/troubleshooting.md#a",
        checksumDocs: "docs/troubleshooting.md#b",
        fetchImpl: (async (url: string) => {
            calls.push(url);
            return new Response(bytes);
        }) as unknown as typeof fetch,
    };
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

test("downloads, verifies and renames", async () => {
    assert.equal(await downloadVerified(opts), "downloaded");
    assert.deepEqual(readFileSync(opts.dest), bytes);
    assert.deepEqual(calls, [opts.url]);
    assert.equal(existsSync(opts.dest + ".part"), false);
});

test("present when the hash already matches; replaces a mismatched file", async () => {
    writeFileSync(opts.dest, "stale");
    assert.equal(await downloadVerified(opts), "downloaded");
    calls.length = 0;
    assert.equal(await downloadVerified(opts), "present");
    assert.equal(calls.length, 0);
});

test("checksum mismatch throws with the checksum docs and leaves no files", async () => {
    await assert.rejects(downloadVerified({ ...opts, sha256: "0".repeat(64) }), (e) => {
        assert.ok(e instanceof BastionError);
        assert.match(e.message, /x\.jar checksum mismatch/);
        assert.equal(e.docs, "docs/troubleshooting.md#b");
        return true;
    });
    assert.equal(existsSync(opts.dest), false);
    assert.equal(existsSync(opts.dest + ".part"), false);
});

test("HTTP errors use the download docs", async () => {
    const fetchImpl = (async () => new Response("no", { status: 404 })) as unknown as typeof fetch;
    await assert.rejects(
        downloadVerified({ ...opts, fetchImpl }),
        /Failed to download Thing \(HTTP 404\)/,
    );
});

test("a stalled download times out", async () => {
    const fetchImpl = ((_u: string, init: RequestInit) =>
        new Promise((_res, rej) => {
            init.signal?.addEventListener("abort", () => rej(init.signal?.reason));
        })) as unknown as typeof fetch;
    await assert.rejects(
        downloadVerified({ ...opts, fetchImpl, timeoutMs: 20 }),
        /Downloading Thing timed out/,
    );
});
