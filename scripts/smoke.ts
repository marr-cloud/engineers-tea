import { spawnSync } from "node:child_process";
import { basename, resolve } from "node:path";
import { BastionError, main } from "./lib/errors.ts";
import { run } from "./lib/exec.ts";
import { repoRoot } from "./lib/paths.ts";
import { findMrpack } from "./publish-modrinth.ts";

const DOCS = "docs/troubleshooting.md";
export const SERVER_IMAGE = "itzg/minecraft-server:java21";
const DEFAULT_TIMEOUT_MS = 15 * 60_000;
const POLL_MS = 3_000;

const READY = /Done \([\d.,]+s\)! For help, type "help"/;
const CRASH_REPORT = /(\S*crash-reports[\\/]\S+\.txt)/;
const TRANSIENT = /java\.net\.(ConnectException|SocketTimeoutException|UnknownHostException)/;

export function isReadyLine(line: string): boolean {
    return READY.test(line);
}

export function isTransientInstallerError(log: string): boolean {
    return TRANSIENT.test(log);
}

/** Last `maxLines` lines of the log, plus any crash report path mentioned anywhere in it. */
export function failureContext(log: string, maxLines = 60): string {
    const lines = log.split(/\r?\n/);
    while (lines.length > 0 && lines.at(-1) === "") lines.pop();
    const tail = lines.slice(-maxLines);
    const crash = lines.map((l) => CRASH_REPORT.exec(l)?.[1]).find(Boolean);
    return crash ? `${tail.join("\n")}\nCrash report: ${crash}` : tail.join("\n");
}

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

function dockerMissing(detail: string): BastionError {
    return new BastionError("Docker is not available", {
        hint: `start Docker Desktop and retry (${detail})`,
        docs: `${DOCS}#docker-missing`,
    });
}

async function docker(args: string[]) {
    try {
        return await run("docker", args);
    } catch (e) {
        throw e instanceof BastionError ? dockerMissing(e.message) : e;
    }
}

export type Outcome = { ok: true } | { ok: false; log: string; reason: string };

export type DockerFn = (
    args: string[],
) => Promise<{ code: number; stdout: string; stderr: string }>;

/** Removes the container on SIGINT/SIGTERM (Node dies before `finally` runs); returns a disposer. */
export function removeOnSignal(
    name: string,
    exit: (code: number) => void = (c) => process.exit(c),
    remove: (name: string) => void = (n) => {
        spawnSync("docker", ["rm", "-fv", n], { stdio: "ignore" });
    },
): () => void {
    const codes: [NodeJS.Signals, number][] = [
        ["SIGINT", 130],
        ["SIGTERM", 143],
    ];
    const registered: [NodeJS.Signals, () => void][] = [];
    for (const [sig, code] of codes) {
        const fn = () => {
            try {
                remove(name);
            } catch {
                // best effort; nothing more can be done while dying
            }
            exit(code);
        };
        process.once(sig, fn);
        registered.push([sig, fn]);
    }
    return () => {
        for (const [sig, fn] of registered) process.removeListener(sig, fn);
    };
}

export async function attempt(
    o: { mrpack: string; image: string; deadline: number },
    dock: DockerFn = docker,
    exit?: (code: number) => void,
): Promise<Outcome> {
    const file = basename(o.mrpack);
    const name = `bastionpack-smoke-${Date.now().toString(36)}`;
    const dispose = removeOnSignal(name, exit);
    try {
        const start = await dock([
            "run",
            "-d",
            "--name",
            name,
            "-e",
            "EULA=TRUE",
            "-e",
            "TYPE=MODRINTH",
            "-e",
            "MEMORY=3G",
            "-e",
            `MODRINTH_MODPACK=/modpacks/${file}`,
            "--mount",
            `type=bind,source=${resolve(o.mrpack)},target=/modpacks/${file},readonly`,
            o.image,
        ]);
        if (start.code !== 0) {
            throw new BastionError("docker run failed", {
                hint: start.stderr.trim() || "is Docker Desktop running?",
                docs: `${DOCS}#docker-missing`,
            });
        }
        let log = "";
        for (;;) {
            const l = await dock(["logs", name]);
            log = l.stdout + l.stderr;
            if (log.split(/\r?\n/).some(isReadyLine)) return { ok: true };
            const st = await dock(["inspect", "-f", "{{.State.Running}}", name]);
            if (st.stdout.trim() !== "true") return { ok: false, log, reason: "the server exited" };
            if (Date.now() > o.deadline) return { ok: false, log, reason: "timed out" };
            await sleep(POLL_MS);
        }
    } finally {
        try {
            await dock(["rm", "-fv", name]);
        } catch (e) {
            console.warn(`Warning: could not remove container ${name}: ${String(e)}`);
        }
        dispose();
    }
}

export async function smoke(o: {
    mrpack: string;
    image: string;
    timeoutMs: number;
}): Promise<void> {
    const deadline = Date.now() + o.timeoutMs;
    console.log(`Smoke test: booting ${basename(o.mrpack)} on ${o.image}`);
    let result = await attempt({ ...o, deadline });
    if (!result.ok && isTransientInstallerError(result.log) && Date.now() < deadline) {
        console.log("Transient installer network error; retrying once with fresh data");
        result = await attempt({ ...o, deadline });
    }
    if (result.ok) {
        console.log("Smoke test passed: server reached the ready line");
        return;
    }
    throw new BastionError(`Server smoke test failed: ${result.reason} before it was ready`, {
        hint: `last log lines:\n${failureContext(result.log)}`,
        docs: `${DOCS}#server-smoke-failed`,
    });
}

if (import.meta.main) {
    main(async () => {
        const mrpack = findMrpack(repoRoot());
        const timeoutMs = Number(process.env["SMOKE_TIMEOUT_MS"]) || DEFAULT_TIMEOUT_MS;
        await smoke({ mrpack, image: SERVER_IMAGE, timeoutMs });
    });
}
