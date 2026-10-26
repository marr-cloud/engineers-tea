import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { run } from "./exec.ts";
import { BastionError } from "./errors.ts";
import {
    createModrinthClient,
    defaultUserAgent,
    formatSearchTable,
    type SearchHit,
} from "./modrinth.ts";

type Call = { url: string; init: RequestInit | undefined };

function stub(status: number, body: unknown): { fetchImpl: typeof fetch; calls: Call[] } {
    const calls: Call[] = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(url), init });
        return new Response(JSON.stringify(body), { status });
    }) as typeof fetch;
    return { fetchImpl, calls };
}

const UA = "o/r (BastionPack)";

test("search sends facets and User-Agent", async () => {
    const { fetchImpl, calls } = stub(200, { hits: [{ slug: "a", title: "A" }] });
    const c = createModrinthClient({ userAgent: UA, fetchImpl });
    const hits = await c.search("farming", { gameVersion: "1.21.1", loader: "neoforge" });
    assert.equal(hits.length, 1);
    const url = new URL(calls[0]!.url);
    assert.equal(url.origin + url.pathname, "https://api.modrinth.com/v2/search");
    assert.equal(url.searchParams.get("query"), "farming");
    assert.equal(
        url.searchParams.get("facets"),
        JSON.stringify([["project_type:mod"], ["versions:1.21.1"], ["categories:neoforge"]]),
    );
    assert.equal((calls[0]!.init!.headers as Record<string, string>)["User-Agent"], UA);
});

test("token is sent as Authorization", async () => {
    const { fetchImpl, calls } = stub(200, []);
    await createModrinthClient({ userAgent: UA, token: "t", fetchImpl }).getProjects(["a", "b"]);
    assert.equal((calls[0]!.init!.headers as Record<string, string>)["Authorization"], "t");
    assert.equal(new URL(calls[0]!.url).searchParams.get("ids"), JSON.stringify(["a", "b"]));
});

test("listVersions passes filters", async () => {
    const { fetchImpl, calls } = stub(200, [{ id: "1", version_number: "1.0.0" }]);
    const v = await createModrinthClient({ userAgent: UA, fetchImpl }).listVersions("p", {
        gameVersion: "1.21.1",
        loader: "neoforge",
    });
    assert.equal(v[0]!.version_number, "1.0.0");
    const url = new URL(calls[0]!.url);
    assert.equal(url.pathname, "/v2/project/p/version");
    assert.equal(url.searchParams.get("game_versions"), JSON.stringify(["1.21.1"]));
    assert.equal(url.searchParams.get("loaders"), JSON.stringify(["neoforge"]));
});

test("createVersion posts the form", async () => {
    const { fetchImpl, calls } = stub(200, { id: "v1" });
    const r = await createModrinthClient({ userAgent: UA, token: "t", fetchImpl }).createVersion(
        new FormData(),
    );
    assert.equal(r.id, "v1");
    assert.equal(calls[0]!.init!.method, "POST");
    assert.ok(calls[0]!.url.endsWith("/version"));
});

async function failure(status: number): Promise<BastionError> {
    const { fetchImpl } = stub(status, {});
    const c = createModrinthClient({ userAgent: UA, fetchImpl });
    try {
        await c.getProjects(["x"]);
    } catch (e) {
        assert.ok(e instanceof BastionError);
        return e;
    }
    throw new Error("expected failure");
}

test("429 -> rate limited hint", async () => {
    const e = await failure(429);
    assert.match(e.hint!, /rate limited, wait a minute/);
    assert.match(e.docs!, /troubleshooting\.md#modrinth-/);
});

test("4xx -> request failed links the full docs anchor", async () => {
    const e = await failure(404);
    assert.ok(e.docs!.endsWith("docs/troubleshooting.md#modrinth-request-failed"));
});

test("401/403 -> token hint", async () => {
    assert.match((await failure(401)).hint!, /MODRINTH_TOKEN scopes/);
    assert.match((await failure(403)).hint!, /MODRINTH_TOKEN scopes/);
});

test("5xx -> retry later hint", async () => {
    assert.match((await failure(503)).hint!, /Modrinth is having trouble, retry later/);
});

test("fetch rejection -> can't reach Modrinth", async () => {
    const fetchImpl = (async () => {
        throw new TypeError("fetch failed");
    }) as typeof fetch;
    const c = createModrinthClient({ userAgent: UA, fetchImpl });
    await assert.rejects(c.search("x", { gameVersion: "1", loader: "n" }), (e: BastionError) => {
        assert.equal(e.message, "Can't reach Modrinth");
        assert.match(e.hint!, /status\.modrinth\.com/);
        assert.equal(e.docs, "docs/troubleshooting.md#modrinth-unreachable");
        return true;
    });
});

test("formatSearchTable aligns columns and maps sides", () => {
    const hit = (o: Partial<SearchHit>): SearchHit => ({
        slug: "s",
        title: "T",
        downloads: 1,
        date_modified: "2026-01-02T03:04:05Z",
        client_side: "required",
        server_side: "unsupported",
        ...o,
    });
    const out = formatSearchTable([
        hit({ slug: "farmers-delight", title: "Farmer's Delight", downloads: 1234567 }),
        hit({ client_side: "required", server_side: "required" }),
        hit({ client_side: "unsupported", server_side: "required" }),
    ]);
    const lines = out.split("\n");
    assert.match(lines[0]!, /^slug\s+title\s+downloads\s+updated\s+side$/);
    assert.match(lines[1]!, /^farmers-delight\s+Farmer's Delight\s+1234567\s+2026-01-02\s+client$/);
    assert.match(lines[2]!, /both$/);
    assert.match(lines[3]!, /server$/);
    const col = lines[0]!.indexOf("title");
    assert.equal(lines[1]!.indexOf("Farmer"), col);
    assert.equal(lines[2]!.indexOf("T", 3), col);
});

async function repoWithRemote(url?: string): Promise<string> {
    const dir = mkdtempSync(join(tmpdir(), "bp-ua-"));
    await run("git", ["init", "-q"], { cwd: dir });
    if (url) await run("git", ["remote", "add", "origin", url], { cwd: dir });
    return dir;
}

test("defaultUserAgent parses https, ssh and falls back", async () => {
    const cases: [string | undefined, string][] = [
        ["https://github.com/acme/pack.git", "acme/pack (BastionPack)"],
        ["https://github.com/acme/pack", "acme/pack (BastionPack)"],
        ["git@github.com:acme/pack.git", "acme/pack (BastionPack)"],
        ["git@github.com:acme/pack", "acme/pack (BastionPack)"],
        ["https://example.com/weird", "unknown/unknown (BastionPack)"],
        [undefined, "unknown/unknown (BastionPack)"],
    ];
    for (const [url, want] of cases) {
        const dir = await repoWithRemote(url);
        try {
            assert.equal(await defaultUserAgent(dir), want);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    }
});

test("getProjects([]) does not call the API", async () => {
    const { fetchImpl, calls } = stub(200, []);
    assert.deepEqual(await createModrinthClient({ userAgent: UA, fetchImpl }).getProjects([]), []);
    assert.equal(calls.length, 0);
});

test("fetch timeout -> can't reach Modrinth", async (t) => {
    t.mock.method(AbortSignal, "timeout", () => AbortSignal.abort());
    const fetchImpl = ((_u: unknown, init?: RequestInit) =>
        new Promise((_res, rej) => {
            init!.signal!.addEventListener("abort", () => rej(new Error("aborted")));
            if (init!.signal!.aborted) rej(new Error("aborted"));
        })) as typeof fetch;
    const c = createModrinthClient({ userAgent: UA, fetchImpl });
    await assert.rejects(
        c.getProjects(["a"]),
        (e: BastionError) => e.message === "Can't reach Modrinth",
    );
});

test("createVersion uses a long timeout, search the short one", async (t) => {
    const spy = t.mock.method(AbortSignal, "timeout", () => new AbortController().signal);
    const { fetchImpl } = stub(200, { hits: [], id: "x" });
    const c = createModrinthClient({ userAgent: UA, fetchImpl });
    await c.search("q", { gameVersion: "1.21.1", loader: "neoforge" });
    await c.createVersion(new FormData());
    assert.deepEqual(
        spy.mock.calls.map((k) => k.arguments[0]),
        [15_000, 300_000],
    );
});
