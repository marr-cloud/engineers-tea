export function devVersion(input: { lastTag: string | null; sha: string }): string {
    return `${input.lastTag ?? "0.0.0"}+dev.${input.sha.slice(0, 7)}`;
}
