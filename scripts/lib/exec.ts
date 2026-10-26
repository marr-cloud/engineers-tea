import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { delimiter, extname, isAbsolute, join } from "node:path";
import { BastionError } from "./errors.ts";

export interface RunOptions {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    inherit?: boolean;
}

export interface RunResult {
    code: number;
    stdout: string;
    stderr: string;
}

const CMD_META = /([()\][%!^"`<>&|;, *?])/g;

function escapeForCmd(arg: string, doubleEscape: boolean): string {
    // CRT-style quoting first (what the child process parses), then caret-escape for cmd.exe.
    let a = arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, "$1$1");
    a = `"${a}"`.replace(CMD_META, "^$1");
    return doubleEscape ? a.replace(CMD_META, "^$1") : a;
}

/** Resolves a command through PATH + PATHEXT (win32 only); undefined if not found. */
function resolveWindows(cmd: string, env: NodeJS.ProcessEnv): string | undefined {
    const exts = (env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean);
    const pathKey = Object.keys(env).find((k) => k.toLowerCase() === "path") ?? "PATH";
    const hasDir = isAbsolute(cmd) || /[\\/]/.test(cmd);
    const dirs = hasDir ? [""] : (env[pathKey] ?? "").split(delimiter);
    const hasExt = extname(cmd) !== "";
    for (const dir of dirs) {
        const base = dir ? join(dir, cmd) : cmd;
        const candidates = hasExt ? [base] : exts.map((e) => base + e);
        for (const c of candidates) {
            if (existsSync(c) && statSync(c).isFile()) return c;
        }
    }
    return undefined;
}

function missing(cmd: string): BastionError {
    return new BastionError(`${cmd} was not found`, {
        hint: `is ${cmd} installed? run \`mise install\``,
        docs: "docs/troubleshooting.md#tool-missing",
    });
}

export function run(cmd: string, args: string[], opts: RunOptions = {}): Promise<RunResult> {
    return new Promise((resolve, reject) => {
        const env = { ...process.env, ...opts.env };
        let file = cmd;
        let argv = args;
        let verbatim = false;
        if (process.platform === "win32") {
            const resolved = resolveWindows(cmd, env);
            if (!resolved) {
                reject(missing(cmd));
                return;
            }
            file = resolved;
            if (/\.(cmd|bat)$/i.test(resolved)) {
                const line = [
                    escapeForCmd(resolved, false),
                    ...args.map((a) => escapeForCmd(a, true)),
                ].join(" ");
                file = env.ComSpec ?? "cmd.exe";
                argv = ["/d", "/s", "/c", `"${line}"`];
                verbatim = true;
            }
        }
        const child = spawn(file, argv, {
            cwd: opts.cwd,
            env,
            stdio: opts.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
            windowsVerbatimArguments: verbatim,
        });
        let stdout = "";
        let stderr = "";
        child.stdout?.on("data", (d: Buffer) => (stdout += d.toString()));
        child.stderr?.on("data", (d: Buffer) => (stderr += d.toString()));
        child.on("error", (err: NodeJS.ErrnoException) => {
            reject(err.code === "ENOENT" ? missing(cmd) : err);
        });
        child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
    });
}
