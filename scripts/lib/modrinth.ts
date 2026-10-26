import { BastionError } from "./errors.ts";
import { run } from "./exec.ts";

const DOCS = "docs/troubleshooting.md";

export type ModrinthProject = {
    id: string;
    slug: string;
    title: string;
    downloads: number;
    client_side: string;
    server_side: string;
    updated: string;
    license: { id: string };
};

export type SearchHit = {
    slug: string;
    title: string;
    downloads: number;
    date_modified: string;
    client_side: string;
    server_side: string;
};

export type ModrinthClient = {
    search(
        query: string,
        f: { gameVersion: string; loader: string; limit?: number },
    ): Promise<SearchHit[]>;
    getProjects(idsOrSlugs: string[]): Promise<ModrinthProject[]>;
    listVersions(
        project: string,
        f?: { gameVersion?: string; loader?: string },
    ): Promise<{ id: string; version_number: string }[]>;
    createVersion(form: FormData): Promise<{ id: string }>;
};

export function createModrinthClient(opts: {
    userAgent: string;
    baseUrl?: string;
    token?: string;
    fetchImpl?: typeof fetch;
}): ModrinthClient {
    const base = opts.baseUrl ?? "https://api.modrinth.com/v2";
    const doFetch = opts.fetchImpl ?? fetch;

    async function request<T>(
        path: string,
        init: RequestInit = {},
        timeoutMs = 15_000,
    ): Promise<T> {
        const headers: Record<string, string> = { "User-Agent": opts.userAgent };
        if (opts.token) headers["Authorization"] = opts.token;
        let res: Response;
        try {
            const timeout = AbortSignal.timeout(timeoutMs);
            const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
            res = await doFetch(base + path, { ...init, headers, signal });
        } catch {
            throw new BastionError("Can't reach Modrinth", {
                hint: "check your connection or https://status.modrinth.com (requests time out after 15s)",
                docs: `${DOCS}#modrinth-unreachable`,
            });
        }
        if (res.ok) {
            try {
                return (await res.json()) as T;
            } catch {
                throw new BastionError("Modrinth returned an unreadable response", {
                    hint: "Modrinth is having trouble, retry later (https://status.modrinth.com)",
                    docs: `${DOCS}#modrinth-server-error`,
                });
            }
        }
        const fail = (message: string, hint: string, docs: string): never => {
            throw new BastionError(message, { hint, docs });
        };
        if (res.status === 429) {
            return fail(
                "Modrinth rate limit hit (HTTP 429)",
                "rate limited, wait a minute and retry",
                `${DOCS}#modrinth-rate-limited`,
            );
        }
        if (res.status === 401 || res.status === 403) {
            return fail(
                `Modrinth rejected the request (HTTP ${res.status})`,
                "check MODRINTH_TOKEN scopes",
                `${DOCS}#modrinth-auth`,
            );
        }
        if (res.status >= 500) {
            return fail(
                `Modrinth returned HTTP ${res.status}`,
                "Modrinth is having trouble, retry later (https://status.modrinth.com)",
                `${DOCS}#modrinth-server-error`,
            );
        }
        return fail(
            `Modrinth request failed (HTTP ${res.status}) for ${path.split("?")[0]}`,
            "check the project slug or id, and the request parameters",
            `${DOCS}#modrinth-request-failed`,
        );
    }

    return {
        async search(query, f) {
            const facets = [
                ["project_type:mod"],
                [`versions:${f.gameVersion}`],
                [`categories:${f.loader}`],
            ];
            const qs = new URLSearchParams({
                query,
                facets: JSON.stringify(facets),
                limit: String(f.limit ?? 20),
            });
            const r = await request<{ hits: SearchHit[] }>(`/search?${qs}`);
            return r.hits;
        },
        getProjects(idsOrSlugs) {
            if (idsOrSlugs.length === 0) return Promise.resolve([]);
            const qs = new URLSearchParams({ ids: JSON.stringify(idsOrSlugs) });
            return request<ModrinthProject[]>(`/projects?${qs}`);
        },
        listVersions(project, f = {}) {
            const qs = new URLSearchParams();
            if (f.gameVersion) qs.set("game_versions", JSON.stringify([f.gameVersion]));
            if (f.loader) qs.set("loaders", JSON.stringify([f.loader]));
            const q = qs.size ? `?${qs}` : "";
            return request(`/project/${encodeURIComponent(project)}/version${q}`);
        },
        createVersion(form) {
            return request<{ id: string }>("/version", { method: "POST", body: form }, 300_000);
        },
    };
}

function side(h: SearchHit): string {
    const client = h.client_side !== "unsupported";
    const server = h.server_side !== "unsupported";
    if (client && server) return "both";
    return server ? "server" : "client";
}

export function formatSearchTable(hits: SearchHit[]): string {
    const rows = [
        ["slug", "title", "downloads", "updated", "side"],
        ...hits.map((h) => [
            h.slug,
            h.title,
            String(h.downloads),
            h.date_modified.slice(0, 10),
            side(h),
        ]),
    ];
    const widths = rows[0]!.map((_, i) => Math.max(...rows.map((r) => r[i]!.length)));
    return rows
        .map((r) =>
            r
                .map((c, i) => c.padEnd(widths[i]!))
                .join("  ")
                .trimEnd(),
        )
        .join("\n");
}

/** Owner and repo of a GitHub https/ssh remote URL, or null for anything else. */
export function parseGithubRemote(url: string): { owner: string; repo: string } | null {
    const m = /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\s*$/.exec(url.trim());
    return m ? { owner: m[1]!, repo: m[2]! } : null;
}

export async function defaultUserAgent(root: string): Promise<string> {
    const fallback = "unknown/unknown (BastionPack)";
    try {
        const r = await run("git", ["remote", "get-url", "origin"], { cwd: root });
        if (r.code !== 0) return fallback;
        const gh = parseGithubRemote(r.stdout);
        return gh ? `${gh.owner}/${gh.repo} (BastionPack)` : fallback;
    } catch {
        return fallback;
    }
}
