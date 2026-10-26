import { BastionError } from "./errors.ts";
import { run, type RunOptions, type RunResult } from "./exec.ts";

export type InstallRunner = (cmd: string, args: string[], opts?: RunOptions) => Promise<RunResult>;

/** Installs the scripts' own npm dependencies (fflate, linters) from the lockfile. */
export async function installDependencies(
    root: string,
    runner: InstallRunner = run,
): Promise<void> {
    const r = await runner("pnpm", ["install", "--frozen-lockfile"], { cwd: root, inherit: true });
    if (r.code !== 0) {
        throw new BastionError(`pnpm install failed (exit ${r.code})`, {
            hint: "see the pnpm output above; check your network, then re-run `task setup`",
            docs: "docs/troubleshooting.md#pnpm-install",
        });
    }
}
