import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { extractSection } from "./lib/changelog.ts";
import { BastionError, main } from "./lib/errors.ts";
import { run } from "./lib/exec.ts";
import { createModrinthClient, defaultUserAgent, type ModrinthClient } from "./lib/modrinth.ts";
import { readMrpackIndex } from "./lib/mrpack.ts";
import { repoRoot } from "./lib/paths.ts";
import { isPrerelease, isSemver, previousReleaseTag } from "./lib/semver.ts";

const DOCS = "docs/troubleshooting.md";
const PLACEHOLDER_ID = "<MODRINTH_PROJECT_ID>";

export type VersionInput = {
    projectId: string;
    version: string;
    name: string;
    changelog: string;
    gameVersion: string;
    loader: string;
    fileName: string;
};

export function buildVersionPayload(i: VersionInput): Record<string, unknown> {
    const versionType = i.version.split("-").slice(1).join("-").startsWith("alpha")
        ? "alpha"
        : isPrerelease(i.version)
          ? "beta"
          : "release";
    return {
        project_id: i.projectId,
        name: i.name,
        version_number: i.version,
        changelog: i.changelog,
        dependencies: [],
        game_versions: [i.gameVersion],
        version_type: versionType,
        loaders: [i.loader],
        featured: false,
        status: "listed",
        file_parts: [i.fileName],
        primary_file: i.fileName,
    };
}

function notice(msg: string): void {
    console.log(process.env["GITHUB_ACTIONS"] === "true" ? `::notice::${msg}` : msg);
}

const LOADER_KEYS: Record<string, string> = {
    neoforge: "neoforge",
    forge: "forge",
    "fabric-loader": "fabric",
    "quilt-loader": "quilt",
};

function detectLoader(deps: Record<string, string>): string {
    for (const [key, loader] of Object.entries(LOADER_KEYS)) if (deps[key]) return loader;
    throw new BastionError("The .mrpack declares no known mod loader", {
        hint: "expected a neoforge entry in modrinth.index.json dependencies; re-run `task build`",
        docs: `${DOCS}#mrpack-invalid`,
    });
}

export async function publishModrinth(o: {
    mrpack: string;
    version: string;
    projectId: string;
    token?: string;
    dryRun: boolean;
    skipExisting?: boolean;
    client: ModrinthClient;
    changelog: string;
    /** Where notices go; defaults to console (workflow commands under GitHub Actions). */
    log?: (msg: string) => void;
}): Promise<{ status: "dry-run" | "published" | "skipped"; versionId?: string }> {
    if (!o.dryRun && (!o.token || !o.projectId)) {
        const missing = [!o.token && "MODRINTH_TOKEN", !o.projectId && "MODRINTH_PROJECT_ID"]
            .filter(Boolean)
            .join(" and ");
        (o.log ?? notice)(`Skipping Modrinth publish: ${missing} not set`);
        return { status: "skipped" };
    }
    if (!isSemver(o.version)) {
        throw new BastionError(`"${o.version}" is not a valid version`, {
            hint: "use MAJOR.MINOR.PATCH with an optional -prerelease, e.g. 1.0.0 or 1.0.0-beta.1",
            docs: `${DOCS}#invalid-version`,
        });
    }
    const index = await readMrpackIndex(o.mrpack);
    if (index.versionId !== o.version) {
        const msg = `The built pack is ${index.versionId}, not ${o.version}`;
        if (!o.dryRun) {
            throw new BastionError(msg, {
                hint: `rebuild with \`task build VERSION=${o.version}\` before publishing`,
                docs: `${DOCS}#publish-version-mismatch`,
            });
        }
        console.log(`warning: ${msg} (a real publish would refuse this)`);
    }
    const gameVersion = index.dependencies["minecraft"];
    if (!gameVersion) {
        throw new BastionError("The .mrpack declares no Minecraft version", {
            hint: "re-run `task build`",
            docs: `${DOCS}#mrpack-invalid`,
        });
    }
    if (o.projectId) {
        const existing = await o.client.listVersions(o.projectId);
        if (existing.some((v) => v.version_number === o.version)) {
            if (o.skipExisting) {
                (o.log ?? notice)(`version ${o.version} already on Modrinth — skipping`);
                return { status: "skipped" };
            }
            throw new BastionError(`version ${o.version} already exists on Modrinth`, {
                hint: "bump the version, or delete that version on Modrinth if it was a mistake",
                docs: `${DOCS}#publish-version-exists`,
            });
        }
    }
    const fileName = basename(o.mrpack);
    const payload = buildVersionPayload({
        projectId: o.projectId || PLACEHOLDER_ID,
        version: o.version,
        name: `${index.name} ${o.version}`,
        changelog: o.changelog,
        gameVersion,
        loader: detectLoader(index.dependencies),
        fileName,
    });
    if (o.dryRun) {
        console.log("Dry run: nothing will be sent to Modrinth.");
        console.log(`Token: ${o.token ? "set (hidden)" : "not set"}`);
        console.log(JSON.stringify(payload, null, 2));
        console.log(`File: ${fileName} (${statSync(o.mrpack).size} bytes)`);
        if (!o.projectId) console.log("Note: MODRINTH_PROJECT_ID not set; duplicate check skipped");
        return { status: "dry-run" };
    }
    const form = new FormData();
    form.append("data", new Blob([JSON.stringify(payload)], { type: "application/json" }));
    form.append(
        fileName,
        new Blob([readFileSync(o.mrpack)], { type: "application/x-modrinth-modpack+zip" }),
        fileName,
    );
    const created = await o.client.createVersion(form);
    console.log(`Published ${o.version} to Modrinth (version id ${created.id})`);
    return { status: "published", versionId: created.id };
}

export function findMrpack(root: string): string {
    const dir = join(root, "build", "modrinth");
    let files: string[] = [];
    try {
        files = readdirSync(dir).filter((f) => f.endsWith(".mrpack"));
    } catch {
        // missing dir is reported below
    }
    if (files.length !== 1) {
        throw new BastionError(
            files.length === 0
                ? "No .mrpack found in build/modrinth"
                : `Expected one .mrpack in build/modrinth, found ${files.length}: ${files.join(", ")}`,
            {
                hint: "run `task build VERSION=x.y.z` (clear build/modrinth first if stale files remain)",
                docs: `${DOCS}#publish-mrpack-missing`,
            },
        );
    }
    return join(dir, files[0]!);
}

function parseArgs(argv: string[]): {
    dryRun: boolean;
    skipExisting: boolean;
    version?: string;
} {
    let dryRun = false;
    let skipExisting = false;
    let version: string | undefined;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]!;
        if (a === "--dry-run") dryRun = true;
        else if (a === "--skip-existing") skipExisting = true;
        else if (a === "--version") version = argv[++i];
        else if (a.startsWith("--version=")) version = a.slice("--version=".length);
        else {
            throw new BastionError(`Unknown argument: ${a}`, {
                hint: "usage: task publish:modrinth -- [--dry-run] [--skip-existing] [--version x.y.z]",
                docs: `${DOCS}#publish-usage`,
            });
        }
    }
    return { dryRun, skipExisting, version };
}

if (import.meta.main) {
    main(async () => {
        const root = repoRoot();
        const args = parseArgs(process.argv.slice(2));
        let version = args.version;
        if (!version) {
            const r = await run("git", ["tag", "--list"], { cwd: root });
            version = previousReleaseTag(r.stdout.split(/\r?\n/).filter(Boolean)) ?? undefined;
            if (!version) {
                throw new BastionError("No version given and no release tag found", {
                    hint: "pass --version x.y.z",
                    docs: `${DOCS}#publish-usage`,
                });
            }
        }
        const token = process.env["MODRINTH_TOKEN"]?.trim() || undefined;
        const projectId = (process.env["MODRINTH_PROJECT_ID"] ?? "").trim();
        const client = createModrinthClient({ userAgent: await defaultUserAgent(root), token });
        const md = readFileSync(join(root, "CHANGELOG.md"), "utf8");
        let changelog = extractSection(md, version);
        if (changelog === null) {
            changelog = `Release ${version}`;
            console.log(`No CHANGELOG.md section for ${version}; using "${changelog}"`);
        }
        await publishModrinth({
            mrpack: findMrpack(root),
            version,
            projectId,
            token,
            dryRun: args.dryRun,
            skipExisting: args.skipExisting,
            client,
            changelog,
        });
    });
}
