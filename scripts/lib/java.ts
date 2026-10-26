/** Extracts the Java major version from `java -version` output; null if unrecognised. */
export function parseJavaMajor(text: string): number | null {
    const m = /version "(\d+)(?:\.(\d+))?/.exec(text) ?? /^\s*"?(\d+)(?:\.(\d+))?/.exec(text);
    if (!m) return null;
    const first = Number(m[1]);
    // Legacy scheme: 1.8.0_392 means Java 8.
    if (first === 1 && m[2] !== undefined) return Number(m[2]);
    return first;
}
