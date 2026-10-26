import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { strToU8, zipSync } from "fflate";
import { BastionError } from "./lib/errors.ts";
import type { ModrinthClient } from "./lib/modrinth.ts";
import { buildVersionPayload, publishModrinth } from "./publish-modrinth.ts";

function makeMrpack(versionId = "1.0.0-beta.2"): string {
    const index = {
        formatVersion: 1,
        name: "BastionPack",
        versionId,
        dependencies: { minecraft: "1.21.1", neoforge: "21.1.172" },
        files: [],
    };
    const dir = mkdtempSync(join(tmpdir(), "bastion-pub-"));
    const file = join(dir, `BastionPack-${versionId}.mrpack`);
    writeFileSync(file, zipSync({ "modrinth.index.json": strToU8(JSON.stringify(index)) }));
    return file;
}

function fakeClient(existing: string[] = []) {
    const calls = { create: 0, form: undefined as FormData | undefined };
    const client: ModrinthClient = {
        search: async () => [],
        getProjects: async () => [],
        listVersions: async () => existing.map((v, i) => ({ id: `v${i}`, version_number: v })),
        createVersion: async (form) => {
            calls.create++;
            calls.form = form;
            return { id: "newid" };
        },
    };
    return { client, calls };
}

const base = {
    projectId: "AABBCCDD",
    version: "1.0.0-beta.2",
    name: "BastionPack 1.0.0-beta.2",
    changelog: "- stuff",
    gameVersion: "1.21.1",
    loader: "neoforge",
    fileName: "BastionPack-1.0.0-beta.2.mrpack",
};

test("payload maps prerelease to beta and fills Modrinth fields", () => {
    const p = buildVersionPayload(base);
    assert.equal(p.version_type, "beta");
    assert.deepEqual(p.game_versions, ["1.21.1"]);
    assert.deepEqual(p.loaders, ["neoforge"]);
    assert.equal(p.project_id, "AABBCCDD");
    assert.equal(p.version_number, "1.0.0-beta.2");
    assert.equal(p.status, "listed");
    assert.equal(p.featured, false);
    assert.deepEqual(p.dependencies, []);
    assert.deepEqual(p.file_parts, [base.fileName]);
    assert.equal(p.primary_file, base.fileName);
});

test("payload version_type: alpha, beta, release", () => {
    const t = (version: string) => buildVersionPayload({ ...base, version }).version_type;
    assert.equal(t("1.0.0-alpha.1"), "alpha");
    assert.equal(t("1.0.0-alpha1"), "alpha");
    assert.equal(t("1.0.0-rc.1"), "beta");
    assert.equal(t("1.0.0"), "release");
});

test("dry-run never calls createVersion and masks the token", async () => {
    const { client, calls } = fakeClient();
    const lines: string[] = [];
    const orig = console.log;
    console.log = (...a: unknown[]) => void lines.push(a.join(" "));
    try {
        const r = await publishModrinth({
            mrpack: makeMrpack(),
            version: "1.0.0-beta.2",
            projectId: "AABBCCDD",
            token: "mrp_supersecret",
            dryRun: true,
            client,
            changelog: "x",
        });
        assert.equal(r.status, "dry-run");
    } finally {
        console.log = orig;
    }
    assert.equal(calls.create, 0);
    assert.ok(lines.join("\n").includes("1.21.1"));
    assert.ok(!lines.join("\n").includes("supersecret"));
});

test("existing version rejects without creating", async () => {
    const { client, calls } = fakeClient(["1.0.0-beta.2"]);
    await assert.rejects(
        publishModrinth({
            mrpack: makeMrpack(),
            version: "1.0.0-beta.2",
            projectId: "AABBCCDD",
            token: "t",
            dryRun: false,
            client,
            changelog: "x",
        }),
        (e: unknown) => e instanceof BastionError && /already exists on Modrinth/.test(e.message),
    );
    assert.equal(calls.create, 0);
});

test("missing token or project id is skipped", async () => {
    const { client, calls } = fakeClient();
    const logs: string[] = [];
    const o = {
        mrpack: "/nonexistent.mrpack",
        version: "1.0.0",
        dryRun: false,
        client,
        changelog: "x",
        log: (m: string) => logs.push(m),
    };
    assert.equal((await publishModrinth({ ...o, projectId: "A" })).status, "skipped");
    assert.equal((await publishModrinth({ ...o, projectId: "", token: "t" })).status, "skipped");
    assert.equal(calls.create, 0);
    assert.deepEqual(logs, [
        "Skipping Modrinth publish: MODRINTH_TOKEN not set",
        "Skipping Modrinth publish: MODRINTH_PROJECT_ID not set",
    ]);
});

test("publishes multipart with data and file part", async () => {
    const { client, calls } = fakeClient();
    const r = await publishModrinth({
        mrpack: makeMrpack(),
        version: "1.0.0-beta.2",
        projectId: "AABBCCDD",
        token: "t",
        dryRun: false,
        client,
        changelog: "- stuff",
    });
    assert.deepEqual(r, { status: "published", versionId: "newid" });
    const data = JSON.parse(await (calls.form!.get("data") as Blob).text());
    assert.equal(data.version_number, "1.0.0-beta.2");
    assert.equal(data.changelog, "- stuff");
    assert.ok(calls.form!.get(data.file_parts[0]) instanceof Blob);
});

test("refuses a real publish when the built pack version differs", async () => {
    const { client, calls } = fakeClient();
    await assert.rejects(
        publishModrinth({
            mrpack: makeMrpack("1.3.3-dev+abc1234"),
            version: "1.0.0",
            projectId: "AABBCCDD",
            token: "t",
            dryRun: false,
            client,
            changelog: "x",
        }),
        (e: unknown) => e instanceof BastionError && /built pack is/.test(e.message),
    );
    assert.equal(calls.create, 0);
});

test("skipExisting returns skipped instead of throwing when the version exists", async () => {
    const { client, calls } = fakeClient(["1.0.0-beta.2"]);
    const logs: string[] = [];
    const r = await publishModrinth({
        mrpack: makeMrpack(),
        version: "1.0.0-beta.2",
        projectId: "AABBCCDD",
        token: "t",
        dryRun: false,
        skipExisting: true,
        client,
        changelog: "x",
        log: (m) => logs.push(m),
    });
    assert.deepEqual(r, { status: "skipped" });
    assert.equal(calls.create, 0);
    assert.deepEqual(logs, ["version 1.0.0-beta.2 already on Modrinth — skipping"]);
});

test("skipExisting still publishes when the version is new", async () => {
    const { client, calls } = fakeClient(["0.9.0"]);
    const r = await publishModrinth({
        mrpack: makeMrpack(),
        version: "1.0.0-beta.2",
        projectId: "AABBCCDD",
        token: "t",
        dryRun: false,
        skipExisting: true,
        client,
        changelog: "x",
    });
    assert.equal(r.status, "published");
    assert.equal(calls.create, 1);
});
