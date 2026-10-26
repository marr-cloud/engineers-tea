import { createHash } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { BastionError } from "./errors.ts";

export async function verifySha256(file: string, expected: string): Promise<boolean> {
    try {
        const hash = createHash("sha256")
            .update(await readFile(file))
            .digest("hex");
        return hash === expected.toLowerCase();
    } catch {
        return false;
    }
}

export interface DownloadVerifiedOptions {
    url: string;
    dest: string;
    sha256: string;
    /** Human name used in messages, e.g. "Pakku". */
    label: string;
    /** File name used in the checksum message, e.g. "pakku.jar". */
    fileName: string;
    /** Retry hint for network failures and timeouts. */
    retryHint: string;
    /** Hint for a checksum mismatch. */
    checksumHint: string;
    /** `docs/troubleshooting.md#...` anchors. */
    downloadDocs: string;
    checksumDocs: string;
    fetchImpl?: typeof fetch;
    /** Abort a stalled download after this many ms (default 120 s). */
    timeoutMs?: number;
}

/** Downloads `url` to `dest` through a `.part` file, verifying SHA-256 before the final rename. */
export async function downloadVerified(
    opts: DownloadVerifiedOptions,
): Promise<"present" | "downloaded"> {
    if (await verifySha256(opts.dest, opts.sha256)) return "present";
    const part = `${opts.dest}.part`;
    const doFetch = opts.fetchImpl ?? fetch;
    try {
        const res = await doFetch(opts.url, {
            signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000),
        });
        if (!res.ok) {
            throw new BastionError(`Failed to download ${opts.label} (HTTP ${res.status})`, {
                hint: `check your network and that ${opts.url} exists`,
                docs: opts.downloadDocs,
            });
        }
        await writeFile(part, Buffer.from(await res.arrayBuffer()));
        if (!(await verifySha256(part, opts.sha256))) {
            throw new BastionError(`${opts.fileName} checksum mismatch`, {
                hint: opts.checksumHint,
                docs: opts.checksumDocs,
            });
        }
        await rename(part, opts.dest);
        return "downloaded";
    } catch (e) {
        await rm(part, { force: true });
        if (e instanceof BastionError) throw e;
        if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
            throw new BastionError(`Downloading ${opts.label} timed out`, {
                hint: opts.retryHint,
                docs: opts.downloadDocs,
            });
        }
        throw new BastionError(`Failed to download ${opts.label}: ${(e as Error).message}`, {
            hint: opts.retryHint,
            docs: opts.downloadDocs,
        });
    }
}
