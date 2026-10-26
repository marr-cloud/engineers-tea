export class BastionError extends Error {
    hint?: string;
    docs?: string;

    constructor(message: string, opts: { hint?: string; docs?: string } = {}) {
        super(message);
        this.name = "BastionError";
        this.hint = opts.hint;
        this.docs = opts.docs;
    }
}

export function formatError(e: unknown): string {
    if (e instanceof BastionError) {
        const lines = [`✖ ${e.message}`];
        if (e.hint) lines.push(`  → ${e.hint}`);
        if (e.docs) lines.push(`  docs: ${e.docs}`);
        return lines.join("\n");
    }
    if (e instanceof Error) {
        const debug = process.env.BASTION_DEBUG === "1" && e.stack;
        return debug ? `✖ ${e.message}\n${e.stack}` : `✖ ${e.message}`;
    }
    return `✖ ${String(e)}`;
}

export function main(fn: () => Promise<void>): void {
    fn().catch((e: unknown) => {
        console.error(formatError(e));
        process.exitCode = 1;
    });
}
