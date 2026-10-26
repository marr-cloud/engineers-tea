import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { BastionError, main } from "./lib/errors.ts";
import { run } from "./lib/exec.ts";
import { repoRoot } from "./lib/paths.ts";

const TROUBLESHOOTING = "docs/troubleshooting.md";
const TROUBLESHOOTING_RE = TROUBLESHOOTING.replace(".", "\\.");
const SKIP_DIRS = new Set(["node_modules", ".git", "superpowers", "build", ".superpowers"]);

/** GitHub heading slug: lowercase, spaces to hyphens, punctuation dropped. */
export function slugify(heading: string): string {
    return heading
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s_-]/gu, "")
        .replace(/\s/g, "-");
}

function stripCode(text: string): string {
    return text.replace(/^(```|~~~)[\s\S]*?^\1/gm, "").replace(/`[^`\n]*`/g, "");
}

/** All anchors a Markdown file defines (headings, with GitHub's -1/-2 suffixes for duplicates). */
function headingAnchors(text: string): Set<string> {
    const seen = new Map<string, number>();
    const out = new Set<string>();
    // Inline code is kept (only the backticks are dropped by slugify); fences are removed.
    const body = text.replace(/^(```|~~~)[\s\S]*?^\1/gm, "");
    for (const m of body.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
        const base = slugify(m[1] ?? "");
        const n = seen.get(base) ?? 0;
        seen.set(base, n + 1);
        out.add(n === 0 ? base : `${base}-${n}`);
    }
    return out;
}

/** Relative Markdown links (and #anchors) that do not resolve. `files` are relative to `root`. */
export function findBrokenLinks(root: string, files: string[]): { file: string; link: string }[] {
    const broken: { file: string; link: string }[] = [];
    for (const file of files) {
        const abs = join(root, file);
        const text = readFileSync(abs, "utf8");
        for (const m of stripCode(text).matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
            const link = m[1] ?? "";
            if (/^[a-z][a-z0-9+.-]*:/i.test(link)) continue; // http:, mailto:, ...
            const hash = link.indexOf("#");
            const pathPart = hash === -1 ? link : link.slice(0, hash);
            const anchor = hash === -1 ? "" : link.slice(hash + 1);
            const target = pathPart === "" ? abs : resolve(dirname(abs), decodeURI(pathPart));
            let ok = existsSync(target);
            if (ok && anchor && statSync(target).isFile() && target.endsWith(".md")) {
                ok = headingAnchors(readFileSync(target, "utf8")).has(anchor.toLowerCase());
            }
            if (!ok) broken.push({ file, link });
        }
    }
    return broken;
}

/** `task <name>` mentions inside code spans/blocks that are not real tasks. */
export function findUnknownTasks(text: string, taskNames: string[]): string[] {
    const known = new Set(taskNames);
    const code = [...text.matchAll(/^(```|~~~)[\s\S]*?^\1|`[^`\n]*`/gm)].map((m) => m[0]);
    const unknown = new Set<string>();
    for (const chunk of code) {
        for (const m of chunk.matchAll(/(?:^|[\s`$])task\s+([a-z][a-z0-9:_-]*)/g)) {
            const name = m[1] ?? "";
            if (!known.has(name)) unknown.add(name);
        }
    }
    return [...unknown];
}

function walk(dir: string, accept: (path: string) => boolean, out: string[] = []): string[] {
    if (!existsSync(dir)) return out;
    for (const name of readdirSync(dir)) {
        if (SKIP_DIRS.has(name)) continue;
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p, accept, out);
        else if (accept(p)) out.push(p);
    }
    return out;
}

/**
 * Every troubleshooting anchor referenced by scripts (non-test .ts) and workflows must be a
 * heading in the troubleshooting page, and every referenced guide page must exist.
 * `required` adds anchors that must exist even if no file references them.
 */
export function findMissingAnchors(root: string, required: string[] = []): string[] {
    const sources = [
        ...walk(join(root, "scripts"), (p) => p.endsWith(".ts") && !p.endsWith(".test.ts")),
        ...walk(join(root, ".github", "workflows"), (p) => /\.ya?ml$/.test(p)),
    ];
    const tsPath = join(root, TROUBLESHOOTING);
    const defined = existsSync(tsPath)
        ? headingAnchors(readFileSync(tsPath, "utf8"))
        : new Set<string>();
    const wanted = new Set(required);
    const guides = new Set<string>();
    const problems = new Set<string>();
    for (const file of sources) {
        const text = readFileSync(file, "utf8");
        const idents = [
            ...text.matchAll(
                new RegExp(`const\\s+(\\w+)\\s*=\\s*["']${TROUBLESHOOTING_RE}["']`, "g"),
            ),
        ].map((m) => m[1] ?? "");
        const refs = [
            new RegExp(`${TROUBLESHOOTING_RE}#([\\w-]+)`, "g"),
            ...idents.map((id) => new RegExp(`\\$\\{${id}\\}#([\\w-]+)`, "g")),
        ];
        for (const re of refs) for (const m of text.matchAll(re)) wanted.add(m[1] ?? "");
        const rel = relative(root, file).split("\\").join("/");
        const dynamic = [
            new RegExp(TROUBLESHOOTING_RE + "#\\$\\{"),
            ...idents.map((id) => new RegExp("\\$\\{" + id + "\\}#\\$\\{")),
        ];
        if (dynamic.some((re) => re.test(text))) {
            problems.add(rel + ": dynamic anchor, use a literal anchor so it can be checked");
        }
        if (/\bdocs:\s*["'`][^"'`/$]*["'`]/.test(text)) {
            problems.add(
                rel +
                    ": bare docs value, use the full troubleshooting docs string with a literal anchor",
            );
        }
        for (const m of text.matchAll(/docs\/guides\/[\w.-]+\.md/g)) guides.add(m[0]);
    }
    const missing = [...wanted]
        .filter((a) => !defined.has(a))
        .map((a) => TROUBLESHOOTING + "#" + a);
    for (const g of guides) if (!existsSync(join(root, g))) missing.push(g);
    return [...missing, ...problems].sort();
}

/** Pages must open with "Use this when" and end with a "Verify it worked" section (spec 4.9). */
export function findPageRuleViolations(root: string, files: string[]): string[] {
    const bad: string[] = [];
    for (const file of files) {
        const body = readFileSync(join(root, file), "utf8");
        const lines = body.split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
        if (!(lines[0] ?? "").startsWith("Use this when")) {
            bad.push(`${file}: first line must start with "Use this when"`);
        }
        if (!/^#{1,6}\s+Verify it worked\s*$/m.test(body)) {
            bad.push(`${file}: missing "Verify it worked" section`);
        }
    }
    return bad;
}

function markdownFiles(root: string): string[] {
    const files = [
        "README.md",
        "AGENTS.md",
        "CONTRIBUTING.md",
        ".github/PULL_REQUEST_TEMPLATE.md",
    ].filter((f) => existsSync(join(root, f)));
    for (const p of walk(join(root, "docs"), (p) => p.endsWith(".md"))) {
        files.push(relative(root, p).split("\\").join("/"));
    }
    return files;
}

if (import.meta.main) {
    main(async () => {
        const root = repoRoot();
        const files = markdownFiles(root);
        const problems: string[] = [];

        for (const b of findBrokenLinks(root, files)) {
            problems.push(`${b.file}: broken link ${b.link}`);
        }

        const list = await run("task", ["--list-all", "--json"], { cwd: root });
        if (list.code !== 0) {
            throw new BastionError("`task --list-all --json` failed", {
                hint: list.stderr.trim() || "is go-task installed? run `mise install`",
                docs: `${TROUBLESHOOTING}#tool-missing`,
            });
        }
        const names = (JSON.parse(list.stdout) as { tasks: { name: string }[] }).tasks.map(
            (t) => t.name,
        );
        for (const f of files) {
            for (const t of findUnknownTasks(readFileSync(join(root, f), "utf8"), names)) {
                problems.push(`${f}: unknown task \`task ${t}\``);
            }
        }

        for (const m of findMissingAnchors(root)) problems.push(`missing: ${m}`);

        const ruled = files.filter((f) =>
            /^docs\/(guides\/|getting-started|concepts|players)/.test(f),
        );
        problems.push(...findPageRuleViolations(root, ruled));

        if (problems.length > 0) {
            throw new BastionError(
                `docs check found ${problems.length} problem(s):\n  ${problems.join("\n  ")}`,
                {
                    hint: "fix the docs (or add the missing troubleshooting heading), then run `task check` again",
                    docs: `${TROUBLESHOOTING}#docs-check-failed`,
                },
            );
        }
        console.log(`docs ok: ${files.length} files`);
    });
}
