import { existsSync, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { downloadVerified } from "./lib/download.ts";
import { BastionError, main } from "./lib/errors.ts";
import { run } from "./lib/exec.ts";
import { repoRoot } from "./lib/paths.ts";
import { findMrpack } from "./publish-modrinth.ts";

const DOCS = "docs/troubleshooting.md";
const AUTHLIB_JAR = "authlib-injector.jar";

/** Reads one `KEY=value` from dotenv text (comments and blank lines ignored, optional quotes stripped). */
export function parseEnvValue(text: string, key: string): string {
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq < 0 || line.slice(0, eq).trim() !== key) continue;
        let v = line.slice(eq + 1).trim();
        if (v.length >= 2 && (v[0] === '"' || v[0] === "'") && v.endsWith(v[0])) v = v.slice(1, -1);
        return v;
    }
    return "";
}

const HOSTNAME =
    /^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)*$/;

/** AUTH_SERVER ends up in a JVM flag: only a hostname or an https:// URL without spaces or quotes. */
export function validateAuthServer(value: string): string {
    const ok = value.startsWith("https://")
        ? value.length > 8 && !/[\s"'`\\]/.test(value)
        : HOSTNAME.test(value);
    if (!ok) {
        throw new BastionError("AUTH_SERVER in server/.env is not valid", {
            hint: "use a hostname such as ely.by, or an https:// URL, with no spaces or quotes",
            docs: `${DOCS}#auth-server-invalid`,
        });
    }
    return value;
}

export function authJvmOpts(authServer: string): string {
    return authServer ? `-javaagent:/authlib/${AUTHLIB_JAR}=${authServer}` : "";
}

/** Makes sure build/authlib exists (compose mounts it) and, for a custom auth server, holds the pinned jar. */
async function prepareAuthlib(root: string): Promise<string> {
    const authServer = validateAuthServer(
        parseEnvValue(readFileSync(join(root, "server", ".env"), "utf8"), "AUTH_SERVER"),
    );
    const dir = join(root, "build", "authlib");
    await mkdir(dir, { recursive: true });
    if (!authServer) return "";
    const version = process.env["AUTHLIB_VERSION"];
    const sha256 = process.env["AUTHLIB_SHA256"];
    if (!version || !sha256) {
        throw new BastionError("AUTHLIB_VERSION / AUTHLIB_SHA256 are not set", {
            hint: "run through `task server:up` so the Taskfile pins are passed in",
            docs: `${DOCS}#authlib-download`,
        });
    }
    await downloadVerified({
        url: `https://github.com/yushijinhun/authlib-injector/releases/download/v${version}/authlib-injector-${version}.jar`,
        dest: join(dir, AUTHLIB_JAR),
        sha256,
        label: "authlib-injector",
        fileName: AUTHLIB_JAR,
        retryHint: "check your network connection and retry `task server:up`",
        checksumHint:
            "retry `task server:up`; if it persists the release asset changed — check AUTHLIB_SHA256",
        downloadDocs: `${DOCS}#authlib-download`,
        checksumDocs: `${DOCS}#authlib-checksum`,
    });
    return authJvmOpts(authServer);
}

export function composeArgs(root: string, rest: string[]): string[] {
    return [
        "compose",
        "-f",
        join(root, "server", "compose.yaml"),
        "--env-file",
        join(root, "server", ".env"),
        ...rest,
    ];
}

/** A rebuilt local pack can keep its filename (same commit), so local runs always recreate and resync. */
export function upPlan(
    cmd: "up" | "update",
    local: boolean,
): { args: string[]; forceSync: boolean } {
    const force = cmd === "update" || local;
    return { args: ["up", "-d", ...(force ? ["--force-recreate"] : [])], forceSync: force };
}

function requireEnv(root: string): void {
    if (!existsSync(join(root, "server", ".env"))) {
        throw new BastionError("server/.env not found", {
            hint: "copy server/.env.example to server/.env and fill in PLAYIT_SECRET_KEY",
            docs: `${DOCS}#server-env-missing`,
        });
    }
}

async function compose(root: string, rest: string[], env: NodeJS.ProcessEnv = {}): Promise<void> {
    const r = await run("docker", composeArgs(root, rest), { inherit: true, env }).catch((e) => {
        throw e instanceof BastionError
            ? new BastionError("Docker is not available", {
                  hint: "start Docker Desktop and retry",
                  docs: `${DOCS}#docker-missing`,
              })
            : e;
    });
    if (r.code !== 0) {
        throw new BastionError(`docker compose ${rest[0]} failed (exit ${r.code})`, {
            hint: "see the output above; is Docker Desktop running?",
            docs: `${DOCS}#docker-missing`,
        });
    }
}

async function build(root: string): Promise<void> {
    const r = await run("node", [join(root, "scripts", "build.ts")], { cwd: root, inherit: true });
    if (r.code !== 0) {
        throw new BastionError("task build failed", {
            hint: "fix the build first, then retry",
            docs: `${DOCS}#export-failed`,
        });
    }
}

if (import.meta.main) {
    main(async () => {
        const root = repoRoot();
        const cmd = process.argv[2];
        requireEnv(root);
        switch (cmd) {
            case "up":
            case "update": {
                // Local mode: always serve the freshly built pack. A published slug in .env is used by `update`.
                const local = process.env["SERVER_USE_ENV_PACK"] !== "true";
                const env: NodeJS.ProcessEnv = {};
                env["AUTH_JVM_OPTS"] = await prepareAuthlib(root);
                if (local) {
                    await build(root);
                    env["MODRINTH_MODPACK"] = `/modpacks/${basename(findMrpack(root))}`;
                }
                const plan = upPlan(cmd, local);
                if (plan.forceSync) env["MODRINTH_FORCE_SYNCHRONIZE"] = "true";
                if (cmd === "update") await compose(root, ["pull"], env);
                await compose(root, plan.args, env);
                break;
            }
            case "down":
                await compose(root, ["down"]);
                break;
            case "logs":
                await compose(root, ["logs", "-f", "--tail", "100"]);
                break;
            default:
                throw new BastionError(`Unknown server command: ${cmd ?? ""}`, {
                    hint: "usage: node scripts/server.ts up|update|down|logs",
                    docs: `${DOCS}#server-usage`,
                });
        }
    });
}
