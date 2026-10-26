import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { extractSection } from "./lib/changelog.ts";
import { BastionError, main } from "./lib/errors.ts";
import { run } from "./lib/exec.ts";
import { repoRoot } from "./lib/paths.ts";
import { isSemver, previousReleaseTag } from "./lib/semver.ts";
import { safeLockDiff } from "./summary.ts";

const DOCS = "docs/troubleshooting.md";

export type ReleaseNotesInput = {
    changelogSection: string;
    diffMarkdown: string | null;
};

export function buildReleaseNotes(i: ReleaseNotesInput): string {
    const section = i.changelogSection.trim() || "No changelog entry for this release.";
    const diff = i.diffMarkdown?.trim() || "First release — no previous version to compare.";
    return `${section}\n\n## Mod changes\n\n${diff}\n`;
}

/** `release-notes.ts <version> [--out <file>]`; defaults to build/release-notes.md. */
export function parseArgs(argv: string[]): { version: string; out: string } {
    let version: string | undefined;
    let out = join("build", "release-notes.md");
    for (let n = 0; n < argv.length; n++) {
        const a = argv[n] ?? "";
        if (a === "--out") {
            const v = argv[++n];
            if (!v) {
                throw new BastionError("--out needs a file path", {
                    hint: "usage: node scripts/release-notes.ts <version> [--out <file>]",
                    docs: `${DOCS}#release-notes-usage`,
                });
            }
            out = v;
        } else if (!version) {
            version = a;
        }
    }
    if (!version || !isSemver(version)) {
        throw new BastionError(`"${version ?? ""}" is not a valid release version`, {
            hint: "usage: node scripts/release-notes.ts <version> [--out <file>] (the tag, e.g. 0.2.0)",
            docs: `${DOCS}#release-notes-usage`,
        });
    }
    return { version, out };
}

if (import.meta.main) {
    main(async () => {
        const { version, out } = parseArgs(process.argv.slice(2));
        const root = repoRoot();
        const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
        const tags = (await run("git", ["tag", "--list"], { cwd: root })).stdout
            .split(/\r?\n/)
            .filter(Boolean);
        const diffMarkdown = await safeLockDiff(previousReleaseTag(tags, version), root);
        const md = buildReleaseNotes({
            changelogSection: extractSection(changelog, version) ?? "",
            diffMarkdown,
        });
        const file = resolve(root, out);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, md);
        console.log(`Wrote release notes for ${version} to ${out}`);
    });
}
