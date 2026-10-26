import { join } from "node:path";
import { BastionError, main } from "./lib/errors.ts";
import { run } from "./lib/exec.ts";
import { installDependencies } from "./lib/install.ts";
import { parseJavaMajor } from "./lib/java.ts";
import { ensurePakku, pakku } from "./lib/pakku.ts";
import { repoRoot } from "./lib/paths.ts";

function requireEnv(name: string): string {
    const v = process.env[name];
    if (!v) {
        throw new BastionError(`${name} is not set`, {
            hint: "run via `task setup` (the Taskfile provides the pinned values)",
            docs: "docs/troubleshooting.md#setup-env",
        });
    }
    return v;
}

main(async () => {
    const root = repoRoot();

    const java = await run("java", ["-version"]);
    const major = parseJavaMajor(java.stderr + java.stdout);
    if (major === null || major < 21) {
        throw new BastionError(`Java 21+ is required (found ${major ?? "unknown"})`, {
            hint: "run `mise install` to get the pinned JDK",
            docs: "docs/troubleshooting.md#java-version",
        });
    }
    console.log(`java: ${major}`);

    await installDependencies(root);
    console.log("pnpm install: ok");

    const version = requireEnv("PAKKU_VERSION");
    const state = await ensurePakku({
        version,
        sha256: requireEnv("PAKKU_SHA256"),
        dest: join(root, "pakku.jar"),
    });
    console.log(`pakku ${version}: ${state}`);

    const fetched = await pakku(["fetch"], { inherit: true });
    if (fetched.code !== 0) {
        throw new BastionError(`pakku fetch failed (exit ${fetched.code})`, {
            hint: "see the Pakku output above; CurseForge-sourced mods may need an API key",
            docs: "docs/troubleshooting.md#pakku-fetch",
        });
    }
    console.log("pakku fetch: ok");

    const git = await run("git", ["config", "core.hooksPath", ".githooks"], { cwd: root });
    if (git.code !== 0) {
        throw new BastionError("git config core.hooksPath failed", {
            hint: git.stderr.trim() || "is this a git checkout?",
            docs: "docs/troubleshooting.md#hooks-install",
        });
    }
    console.log("git hooks: enabled");
});
