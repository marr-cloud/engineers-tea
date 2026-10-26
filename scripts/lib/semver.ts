const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

/** `MAJOR.MINOR.PATCH` with an optional `-prerelease`; no `v` prefix, no build metadata. */
export function isSemver(v: string): boolean {
    return SEMVER.test(v);
}

export function isPrerelease(v: string): boolean {
    return SEMVER.exec(v)?.[4] !== undefined;
}

function comparePre(a: string, b: string): number {
    const as = a.split(".");
    const bs = b.split(".");
    for (let i = 0; i < Math.max(as.length, bs.length); i++) {
        const x = as[i];
        const y = bs[i];
        if (x === undefined) return -1;
        if (y === undefined) return 1;
        const xn = /^\d+$/.test(x);
        const yn = /^\d+$/.test(y);
        if (xn && yn) {
            if (Number(x) !== Number(y)) return Number(x) < Number(y) ? -1 : 1;
        } else if (xn !== yn) {
            return xn ? -1 : 1;
        } else if (x !== y) {
            return x < y ? -1 : 1;
        }
    }
    return 0;
}

export function compareSemver(a: string, b: string): number {
    const ma = SEMVER.exec(a);
    const mb = SEMVER.exec(b);
    if (!ma || !mb) throw new Error(`not a semver: ${ma ? b : a}`);
    for (let i = 1; i <= 3; i++) {
        const d = Number(ma[i]) - Number(mb[i]);
        if (d !== 0) return d < 0 ? -1 : 1;
    }
    const pa = ma[4];
    const pb = mb[4];
    if (pa === undefined && pb === undefined) return 0;
    if (pa === undefined) return 1;
    if (pb === undefined) return -1;
    return comparePre(pa, pb);
}

/** Greatest semver tag strictly below `current` (or overall when absent); non-semver tags are ignored. */
export function previousReleaseTag(tags: string[], current?: string): string | null {
    const eligible = tags
        .filter(isSemver)
        .filter((t) => current === undefined || compareSemver(t, current) < 0)
        .sort(compareSemver);
    return eligible.at(-1) ?? null;
}
