import assert from "node:assert/strict";
import {
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { BastionError } from "./lib/errors.ts";
import { freshChangelog } from "./lib/changelog.ts";
import { applyInit, composeProjectName, defaultHelpLink, parseInitArgs } from "./init.ts";
import { parseGithubRemote } from "./lib/modrinth.ts";
import { run } from "./lib/exec.ts";

const real = join(import.meta.dirname, "..");
// These tests copy the template's own files as fixtures, so they only make sense before
// `task init`; in a pack made from the template they are skipped.
const initialized =
    JSON.parse(readFileSync(join(real, "pakku.json"), "utf8")).name !== "BastionPack";
const templateTest = initialized ? test.skip : test;
let root: string;
beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "init-test-"));
    for (const f of [
        "pakku.json",
        "CHANGELOG.md",
        "README.md",
        ".pakku/prism-overrides/instance.cfg",
        "server/.env.example",
        "server/compose.yaml",
        "config/crash_assistant/config.toml",
    ]) {
        mkdirSync(join(root, f, ".."), { recursive: true });
        cpSync(join(real, f), join(root, f));
    }
    mkdirSync(join(root, "docs/superpowers/plans"), { recursive: true });
    writeFileSync(join(root, "docs/superpowers/plans/x.md"), "x");
    writeFileSync(join(root, "docs/getting-started.md"), "g");
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const answers = {
    name: "Engineer's Tea",
    author: "Ann",
    description: 'A "cozy" pack',
    modrinthSlug: "engineers-tea",
    creators: "Ann_1, bob",
    helpLink: "https://github.com/ann/engineers-tea/issues",
};
const read = (f: string) => readFileSync(join(root, f), "utf8");

templateTest("applyInit rewrites everything for a name with spaces and apostrophe", () => {
    applyInit(root, answers);
    const cfg = JSON.parse(read("pakku.json"));
    assert.equal(cfg.name, "Engineer's Tea");
    assert.equal(cfg.author, "Ann");
    assert.equal(cfg.description, 'A "cozy" pack');
    assert.equal(cfg.version, "0.0.0-dev");
    assert.deepEqual(cfg.overrides.slice(0, 1), ["config"]);
    assert.equal(existsSync(join(root, "docs/superpowers")), false);
    assert.equal(existsSync(join(root, "docs/getting-started.md")), true);
    assert.equal(read("CHANGELOG.md"), freshChangelog());
    const inst = read(".pakku/prism-overrides/instance.cfg");
    assert.match(inst, /^name=Engineer's Tea$/m);
    assert.match(inst, /PreLaunchCommand=/);
    const readme = read("README.md");
    assert.match(readme, /^# Engineer's Tea$/m);
    assert.match(readme, /A "cozy" pack/);
    assert.match(readme, /https:\/\/modrinth\.com\/modpack\/engineers-tea/);
    assert.match(readme, /Built with BastionPack/);
    assert.match(readme, /docs\/getting-started\.md/);
    const env = read("server/.env.example");
    assert.match(env, /^# MODRINTH_MODPACK=engineers-tea$/m);
    assert.match(env, /^# MODRINTH_MODPACK=\/modpacks\//m);
});

templateTest("without a slug the README has no Modrinth link and .env.example is untouched", () => {
    const before = read("server/.env.example");
    applyInit(root, { name: "Plain", author: "A", description: "d", creators: "Ann" });
    assert.doesNotMatch(read("README.md"), /modrinth\.com\/modpack/);
    assert.equal(read("server/.env.example"), before);
});

templateTest("second run is refused unless forced", () => {
    applyInit(root, answers);
    assert.throws(
        () => applyInit(root, { ...answers, name: "Other" }),
        (e) =>
            e instanceof BastionError &&
            /troubleshooting\.md#init-already-initialized/.test(e.docs ?? ""),
    );
    applyInit(root, { ...answers, name: "Other" }, { force: true });
    assert.equal(JSON.parse(read("pakku.json")).name, "Other");
});

templateTest("invalid answers are rejected before touching anything", () => {
    for (const bad of [
        { name: " " },
        { name: "a\nb" },
        { author: "" },
        { modrinthSlug: "Bad Slug" },
        { creators: "" },
        { creators: "ok_name, no" },
        { creators: "bad name" },
        { creators: "Ann," },
        { helpLink: "http://example.com" },
        { helpLink: "https://exa mple.com" },
    ]) {
        assert.throws(() => applyInit(root, { ...answers, ...bad }), BastionError);
    }
    assert.equal(JSON.parse(read("pakku.json")).name, "BastionPack");
    assert.equal(existsSync(join(root, "docs/superpowers")), true);
});

test("parseInitArgs reads flags", () => {
    assert.deepEqual(
        parseInitArgs([
            "--name",
            "N",
            "--author=A",
            "--description",
            "D",
            "--modrinth-slug",
            "s",
            "--creators",
            "Ann,bob",
            "--help-link=https://x.dev/help",
            "--force",
        ]),
        {
            name: "N",
            author: "A",
            description: "D",
            modrinthSlug: "s",
            creators: "Ann,bob",
            helpLink: "https://x.dev/help",
            force: true,
        },
    );
    assert.throws(() => parseInitArgs(["--bogus"]), BastionError);
    assert.throws(() => parseInitArgs(["--name"]), BastionError);
});

templateTest("a failed write leaves pakku.json untouched and the repo re-runnable", () => {
    rmSync(join(root, ".pakku"), { recursive: true });
    assert.throws(
        () => applyInit(root, answers),
        (e) => e instanceof BastionError && /init-failed/.test(e.docs ?? ""),
    );
    assert.equal(JSON.parse(read("pakku.json")).name, "BastionPack");
    mkdirSync(join(root, ".pakku/prism-overrides"), { recursive: true });
    applyInit(root, answers);
    assert.equal(JSON.parse(read("pakku.json")).name, "Engineer's Tea");
});

const ca = "config/crash_assistant/config.toml";
const KEYS = /^\s*(help_link|formulation_type|modpack_name|modpack_creators) =/;

templateTest(
    "Crash Assistant config gets creators, link and GitHub wording; the rest is untouched",
    () => {
        const before = read(ca);
        applyInit(root, answers);
        const after = read(ca);
        assert.match(
            after,
            /^\thelp_link = "https:\/\/github\.com\/ann\/engineers-tea\/issues"\r?$/m,
        );
        assert.match(after, /^\tformulation_type = "GITHUB"\r?$/m);
        assert.match(after, /^\tmodpack_name = "Engineer's Tea"\r?$/m);
        assert.match(after, /^\tmodpack_creators = \["Ann_1", "bob"\]\r?$/m);
        const rest = (s: string) => s.split("\n").filter((l) => !KEYS.test(l));
        assert.deepEqual(rest(after), rest(before));
    },
);

templateTest(
    "Crash Assistant: other links keep DISCORD, values are escaped, no link keeps the placeholder",
    () => {
        applyInit(root, {
            ...answers,
            name: String.raw`Say "hi" \o/`,
            helpLink: "https://discord.gg/abc",
        });
        const a = read(ca);
        assert.match(a, /^\thelp_link = "https:\/\/discord\.gg\/abc"\r?$/m);
        assert.match(a, /^\tformulation_type = "DISCORD"\r?$/m);
        assert.ok(a.includes("\tmodpack_name = " + String.raw`"Say \"hi\" \\o/"`));

        const { helpLink: _drop, ...noLink } = answers;
        cpSync(join(real, ca), join(root, ca));
        applyInit(root, noLink, { force: true });
        assert.match(read(ca), /^\thelp_link = "CHANGE_ME"\r?$/m);
    },
);

templateTest("a missing Crash Assistant config is skipped", () => {
    rmSync(join(root, ca));
    applyInit(root, answers);
    assert.equal(existsSync(join(root, ca)), false);
    assert.equal(JSON.parse(read("pakku.json")).name, "Engineer's Tea");
});

templateTest("invalid creators leave the Crash Assistant config untouched", () => {
    const before = read(ca);
    assert.throws(() => applyInit(root, { ...answers, creators: "x" }), BastionError);
    assert.equal(read(ca), before);
});

test("parseGithubRemote handles https and ssh remotes", () => {
    assert.deepEqual(parseGithubRemote("https://github.com/ann/pack.git\n"), {
        owner: "ann",
        repo: "pack",
    });
    assert.deepEqual(parseGithubRemote("git@github.com:ann/pack"), { owner: "ann", repo: "pack" });
    assert.equal(parseGithubRemote("https://gitlab.com/ann/pack"), null);
});

test("defaultHelpLink derives the issues URL from a GitHub origin", async () => {
    await run("git", ["init", "-q"], { cwd: root });
    assert.equal(await defaultHelpLink(root), undefined);
    await run("git", ["remote", "add", "origin", "git@github.com:ann/pack.git"], { cwd: root });
    assert.equal(await defaultHelpLink(root), "https://github.com/ann/pack/issues");
    await run("git", ["remote", "set-url", "origin", "https://example.com/x/y.git"], { cwd: root });
    assert.equal(await defaultHelpLink(root), undefined);
});

// Every pack used to inherit `name: bastionpack`, so two packs on one PC shared a Docker project
// and the same world volume.
test("composeProjectName makes a Docker-safe name from the pack name", () => {
    assert.equal(composeProjectName("Engineer's Tea"), "engineers-tea");
    assert.equal(composeProjectName('Tea, "Deluxe" 2'), "tea-deluxe-2");
    assert.equal(composeProjectName("!!!"), "minecraft-pack");
});

templateTest("applyInit names the server's Docker project after the pack", () => {
    applyInit(root, answers);
    assert.match(read("server/compose.yaml"), /^name: engineers-tea\r?$/m);
    assert.doesNotMatch(read("server/compose.yaml"), /bastionpack/);
});
