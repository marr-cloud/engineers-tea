import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promoteUnreleased, validateRelease } from "./lib/changelog.ts";
import { BastionError, main } from "./lib/errors.ts";
import { run, type RunResult } from "./lib/exec.ts";
import { repoRoot } from "./lib/paths.ts";

export type Runner = (cmd: string, args: string[], opts?: { cwd?: string }) => Promise<RunResult>;

async function git(runner: Runner, root: string, args: string[]): Promise<string> {
    const r = await runner("git", args, { cwd: root });
    if (r.code !== 0) {
        throw new BastionError(`git ${args.join(" ")} failed`, {
            hint: r.stderr.trim() || "see the git output above",
            docs: "docs/troubleshooting.md#release-git-failed",
        });
    }
    return r.stdout.trim();
}

const GIT_FAILED = "docs/troubleshooting.md#release-git-failed";

/** Runs a git step after CHANGELOG.md was written; on failure explains the local state and how to recover. */
async function step(
    runner: Runner,
    root: string,
    args: string[],
    state: string,
    recovery: string,
): Promise<void> {
    const r = await runner("git", args, { cwd: root });
    if (r.code === 0) return;
    const detail = (r.stderr.trim() || r.stdout.trim() || "no output").slice(0, 2000);
    throw new BastionError(`git ${args.join(" ")} failed: ${detail}`, {
        hint: `${state} ${recovery}`,
        docs: GIT_FAILED,
    });
}

const USAGE = "usage: task release -- x.y.z";

/** The only accepted argument is the version; anything else must not start a release. */
export function parseReleaseArgs(args: string[]): string {
    const [version, ...extra] = args;
    if (!version) {
        throw new BastionError("Missing version", {
            hint: USAGE,
            docs: "docs/troubleshooting.md#invalid-version",
        });
    }
    if (extra.length > 0) {
        throw new BastionError(`Unknown argument: ${extra[0]}`, {
            hint: USAGE,
            docs: "docs/troubleshooting.md#invalid-version",
        });
    }
    return version;
}

export async function release(
    root: string,
    version: string,
    runner: Runner = run,
    today: string = new Date().toISOString().slice(0, 10),
): Promise<void> {
    const file = join(root, "CHANGELOG.md");
    const changelog = readFileSync(file, "utf8");
    const fetched = await runner("git", ["fetch", "--tags", "origin"], { cwd: root });
    if (fetched.code !== 0) {
        throw new BastionError("Can't reach origin to check for remote changes", {
            hint: fetched.stderr.trim() || "check your network and the `origin` remote",
            docs: GIT_FAILED,
        });
    }
    const state = {
        version,
        branch: await git(runner, root, ["rev-parse", "--abbrev-ref", "HEAD"]),
        clean: (await git(runner, root, ["status", "--porcelain"])) === "",
        tags: (await git(runner, root, ["tag", "--list"])).split(/\r?\n/).filter(Boolean),
        changelog,
    };
    validateRelease(state);
    const hasRemoteMain = await runner(
        "git",
        ["rev-parse", "--verify", "--quiet", "refs/remotes/origin/main"],
        { cwd: root },
    );
    if (hasRemoteMain.code === 0) {
        const anc = await runner("git", ["merge-base", "--is-ancestor", "origin/main", "HEAD"], {
            cwd: root,
        });
        if (anc.code !== 0) {
            throw new BastionError("Local main is behind or diverged from origin/main", {
                hint: "run `git pull --rebase`, then release again",
                docs: "docs/troubleshooting.md#release-out-of-date",
            });
        }
    }
    writeFileSync(file, promoteUnreleased(changelog, version, today));
    const undoFile = "To undo: `git restore --staged --worktree CHANGELOG.md`.";
    await step(runner, root, ["add", "CHANGELOG.md"], "CHANGELOG.md was modified.", undoFile);
    await step(
        runner,
        root,
        ["commit", "-m", `chore: release ${version}`],
        "CHANGELOG.md was modified and staged, but no commit was made.",
        `Fix the cause (hook, signing, identity) and rerun, or undo with \`git restore --staged --worktree CHANGELOG.md\`.`,
    );
    await step(
        runner,
        root,
        ["tag", version],
        "The release commit exists locally but is not tagged.",
        `Undo with \`git reset --hard HEAD~1\`, or fix the cause and run \`git tag ${version} && git push --atomic origin main ${version}\`.`,
    );
    await step(
        runner,
        root,
        ["push", "--atomic", "origin", "main", version],
        "The release commit and tag exist locally but were not pushed.",
        `Retry with \`git push --atomic origin main ${version}\`, or undo with \`git tag -d ${version}\` and \`git reset --hard HEAD~1\`.`,
    );
    console.log(`Released ${version}; CI will build and publish from the tag.`);
}

if (import.meta.main) {
    main(async () => {
        await release(repoRoot(), parseReleaseArgs(process.argv.slice(2)));
    });
}
