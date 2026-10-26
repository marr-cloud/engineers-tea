import { existsSync } from "node:fs";
import { join } from "node:path";
import { downloadVerified, verifySha256 } from "./download.ts";
import { BastionError } from "./errors.ts";
import { run, type RunResult } from "./exec.ts";
import { repoRoot } from "./paths.ts";

export { verifySha256 };

export interface EnsurePakkuOptions {
    version: string;
    sha256: string;
    dest: string;
    fetchImpl?: typeof fetch;
    /** Abort a stalled download after this many ms (default 120 s). */
    timeoutMs?: number;
}

export async function ensurePakku(opts: EnsurePakkuOptions): Promise<"present" | "downloaded"> {
    return downloadVerified({
        url: `https://github.com/juraj-hrivnak/pakku/releases/download/v${opts.version}/pakku.jar`,
        dest: opts.dest,
        sha256: opts.sha256,
        label: "Pakku",
        fileName: "pakku.jar",
        retryHint: "check your network connection and retry `task setup`",
        checksumHint:
            "re-run `task setup`; if it persists the release asset changed — check PAKKU_SHA256",
        downloadDocs: "docs/troubleshooting.md#pakku-download",
        checksumDocs: "docs/troubleshooting.md#pakku-checksum",
        fetchImpl: opts.fetchImpl,
        timeoutMs: opts.timeoutMs,
    });
}

export async function pakku(
    args: string[],
    opts: { cwd?: string; inherit?: boolean } = {},
): Promise<RunResult> {
    const root = repoRoot();
    const jar = join(root, "pakku.jar");
    if (!existsSync(jar)) {
        throw new BastionError("pakku.jar not found", {
            hint: "run `task setup`",
            docs: "docs/troubleshooting.md#pakku-missing",
        });
    }
    return run("java", ["-jar", jar, ...args], { cwd: opts.cwd ?? root, inherit: opts.inherit });
}
