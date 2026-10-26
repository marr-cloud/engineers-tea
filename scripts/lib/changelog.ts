import { BastionError } from "./errors.ts";
import { compareSemver, isSemver, previousReleaseTag } from "./semver.ts";

const DOCS = "docs/troubleshooting.md";
const HEADING = /^## \[([^\]]+)\][^\r\n]*$/gm;

interface Section {
    name: string;
    start: number; // index of the heading line
    bodyStart: number;
    end: number; // index of the next "## " heading (or end of file)
}

function sections(md: string): Section[] {
    return [...md.matchAll(HEADING)].map((m) => {
        const start = m.index;
        const bodyStart = start + m[0].length;
        const next = md.slice(bodyStart).search(/^## /m);
        const end = next === -1 ? md.length : bodyStart + next;
        return { name: m[1] ?? "", start, bodyStart, end };
    });
}

function find(md: string, version: string): Section | undefined {
    const unreleased = version.toLowerCase() === "unreleased";
    return sections(md).find((s) =>
        unreleased ? s.name.toLowerCase() === "unreleased" : s.name === version,
    );
}

/** Body of `## [<version>]` (case-insensitive for `Unreleased`), trimmed; null if absent. */
export function extractSection(md: string, version: string): string | null {
    const s = find(md, version);
    return s ? md.slice(s.bodyStart, s.end).trim() : null;
}

function emptyChangelog(): BastionError {
    return new BastionError("The [Unreleased] section of CHANGELOG.md is empty", {
        hint: "describe the changes under `## [Unreleased]` before releasing",
        docs: `${DOCS}#release-empty-changelog`,
    });
}

export function promoteUnreleased(md: string, version: string, isoDate: string): string {
    const unreleased = find(md, "Unreleased");
    const body = unreleased ? md.slice(unreleased.bodyStart, unreleased.end).trim() : "";
    if (!unreleased || body === "") throw emptyChangelog();
    if (find(md, version)) {
        throw new BastionError(`CHANGELOG.md already has a section for ${version}`, {
            hint: "pick a new version number",
            docs: `${DOCS}#release-version-exists`,
        });
    }
    const before = md.slice(0, unreleased.start);
    const after = md.slice(unreleased.end);
    const tail = after === "" ? "" : `\n${after}`;
    return `${before}## [Unreleased]\n\n## [${version}] - ${isoDate}\n\n${body}\n${tail}`;
}

export interface ReleaseState {
    version: string;
    branch: string;
    clean: boolean;
    tags: string[];
    changelog: string;
}

export function validateRelease(s: ReleaseState): void {
    if (!isSemver(s.version)) {
        throw new BastionError(`"${s.version}" is not a valid version`, {
            hint: "use MAJOR.MINOR.PATCH (optionally -beta.1), without a leading v, e.g. 0.2.0",
            docs: `${DOCS}#invalid-version`,
        });
    }
    if (s.branch !== "main") {
        throw new BastionError(`Releases are cut from main, but you are on "${s.branch}"`, {
            hint: "merge your work into main and `git switch main`",
            docs: `${DOCS}#release-branch`,
        });
    }
    if (!s.clean) {
        throw new BastionError("The working tree has uncommitted changes", {
            hint: "commit or stash them before releasing",
            docs: `${DOCS}#release-dirty-tree`,
        });
    }
    if (s.tags.includes(s.version)) {
        throw new BastionError(`Tag ${s.version} already exists`, {
            hint: "choose a new version number",
            docs: `${DOCS}#release-version-exists`,
        });
    }
    const prev = previousReleaseTag(s.tags);
    if (prev !== null && compareSemver(s.version, prev) <= 0) {
        throw new BastionError(
            `Version ${s.version} must be greater than the previous release ${prev}`,
            {
                hint: "bump the version; delete inherited tags from a template origin if they are not yours",
                docs: `${DOCS}#release-version-order`,
            },
        );
    }
    if ((extractSection(s.changelog, "Unreleased") ?? "") === "") throw emptyChangelog();
}

const CHANGELOG_HEADER = `# Changelog

All notable changes to this modpack are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/).
`;

/** A pristine CHANGELOG.md: the Keep a Changelog header and an empty Unreleased section. */
export function freshChangelog(): string {
    return `${CHANGELOG_HEADER}\n## [Unreleased]\n`;
}
