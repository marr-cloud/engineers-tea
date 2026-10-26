# BastionPack Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn this PanPack clone into BastionPack: a Modrinth-first, 1.21.1 NeoForge modpack template with one `task` entry point, CI that boots a real server from the built `.mrpack`, tag-driven releases, weekly mod-update PRs, and short English docs for humans and AI agents.

**Architecture:** Pakku stays the mod manager. Every action is a `task` in `Taskfile.yml`; anything beyond a one-liner is a small TypeScript module in `scripts/` run directly by Node (native type stripping) and unit-tested with `node --test`. GitHub workflows install the toolchain from `mise.toml` and call the same tasks, so local and CI behave the same.

**Tech Stack:** Pakku 1.5.x (Java 21), Task v3, mise, Node 24 LTS, pnpm, TypeScript (type-check only), oxlint, oxfmt, fflate (zip reading), Docker `itzg/minecraft-server`, playit.gg agent, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-23-bastionpack-template-design.md` — read it before any task. Section numbers below (§4.5 etc.) refer to it.

## Global Constraints

- Minecraft `1.21.1`, loader `neoforge` (latest stable `21.1.x`), Java `21`, lock `target: "modrinth"`.
- Pakku pinned to one version + SHA-256 (Taskfile vars `PAKKU_VERSION`, `PAKKU_SHA256`). Use the latest *release* at build time (1.5.0 today; take a newer one if it contains the #131 Modrinth side fix).
- Node 24 LTS native TypeScript: **erasable syntax only** (no `enum`, `namespace`, parameter properties, decorators); relative imports include the `.ts` extension; `tsconfig.json` has `"noEmit": true, "allowImportingTsExtensions": true, "erasableSyntaxOnly": true, "verbatimModuleSyntax": true, "module": "nodenext", "strict": true`.
- Scripts spawn processes with argument arrays (`child_process.spawn`, no `shell: true`) — no quoting bugs on Windows.
- Taskfile commands must work on Windows/Linux/macOS through Task's built-in shell; no `cp`, `rm -rf`, `sed`, `jq` in tasks — use scripts or Task built-ins.
- Every failure prints: what failed, what to do, and a `docs/troubleshooting.md#<anchor>` link (via `BastionError`, Task 2).
- Missing optional secrets/variables (`MODRINTH_TOKEN`, `MODRINTH_PROJECT_ID`, `DISCORD_WEBHOOK`, CurseForge) → skip with `::notice::`, never fail.
- No `# Change this!` anywhere; names come from `pakku.json`, `github.*` context, or repo variables.
- GitHub Actions pinned to exact release tags (e.g. `actions/checkout@v5.0.0`), every workflow declares `permissions`.
- Modrinth API requests send `User-Agent: <owner>/<repo> (BastionPack)`; base URL `https://api.modrinth.com/v2`.
- All user-facing text and docs in English. License LGPL-3.0, PanPack credited.
- `.gitattributes` forces `eol=lf` for `*.ts`, `*.js`, `*.json`, `*.yml`, `*.md`, `.githooks/*`.
- Tests: `scripts/**/*.test.ts`, run with `node --test "scripts/**/*.test.ts"` (`task test`).

## Review Focus

1. **Paths with spaces and apostrophes** (Prism instance `Engineer's Tea`, `C:\Users\Some Name\…`) → every task works; pinned by `checkInstanceLayout`/`build` tests using such a path (Tasks 5, 6).
2. **Modrinth API down, rate-limited (429) or offline** during `doctor`/`mods:find`/`publish` → one clear line with a hint, no stack trace; pinned by modrinth client tests (Task 7).
3. **Export fails midway** → `pakku.json` version is restored and the tree is clean; pinned by build test with a failing fake Pakku (Task 5).
4. **Tags that aren't BastionPack semver** (inherited `1.3.3`, `v0.1.0`, `latest`) or no tags at all → previous-tag lookup ignores them / reports "first release"; pinned by semver tests (Task 5) and `validateRelease` tests (Task 9).
5. **Interrupted or tampered Pakku download** → checksum mismatch deletes the file and explains; pinned by `ensurePakku` test (Task 3).

---

## File Structure

```
Taskfile.yml                 # public tasks (§4.5); thin, calls scripts
mise.toml                    # java 21, node 24, pnpm, task
package.json  pnpm-lock.yaml tsconfig.json  .oxlintrc.json  .oxfmtrc.json
.githooks/pre-commit         # runs `task check:staged`
oxlint-plugin/bastion.js     # example JS plugin rule + fixtures/
scripts/
  lib/errors.ts              # BastionError, main(), formatError()
  lib/exec.ts                # run()
  lib/paths.ts               # repoRoot()
  lib/pakku.ts               # ensurePakku(), verifySha256(), pakku()
  lib/lock.ts                # PakkuLock/PakkuConfig types, read/write
  lib/modrinth.ts            # createModrinthClient()
  lib/mrpack.ts              # readMrpackIndex()
  lib/semver.ts              # isSemver(), compareSemver(), previousReleaseTag(), isPrerelease()
  lib/version.ts             # devVersion()
  lib/changelog.ts           # extractSection(), promoteUnreleased()
  build.ts  prism.ts  mods.ts  doctor.ts  smoke.ts  summary.ts
  release.ts  release-notes.ts  publish-modrinth.ts  init.ts  check-docs.ts
  *.test.ts next to each module
server/compose.yaml  server/.env.example
.pakku/prism-overrides/instance.cfg  .pakku/prism-overrides/mmc-pack.json
.github/workflows/ci.yml release.yml mod-updates.yml
.github/dependabot.yml  .github/ISSUE_TEMPLATE/*  .github/PULL_REQUEST_TEMPLATE.md
README.md AGENTS.md CONTRIBUTING.md CHANGELOG.md docs/** (§4.9)
```

---

### Task 1: Verification spikes

Run the spec §5 spikes that don't need the user's GUI. Results drive Tasks 4, 5, 11, 14.

**Files:**
- Create: `docs/superpowers/notes/2026-10-23-spikes.md`

**Interfaces:**
- Produces: a notes file with one section per spike: *question, command run, observed output, decision*. Later tasks cite it.

- [ ] **Step 1: Spike 1 — CF-only mod in a Modrinth-target pack.** In a scratch dir (not the repo): download pinned Pakku, `pakku init` (1.21.1, neoforge, target modrinth), `pakku add prj --cf projecte`, `pakku add create`, `pakku export`. Record: does `add` work with target modrinth, is ProjectE in `overrides/mods/` of the `.mrpack`, any warnings. If it fails, repeat with `pakku set -t multiplatform` and record mismatch warnings.
- [ ] **Step 2: Spike 2+3 — itzg with a local `.mrpack`.** `docker run` `itzg/minecraft-server` with `TYPE=MODRINTH`, `EULA=TRUE`, `MODRINTH_MODPACK=/modpacks/<file>.mrpack` (bind mount) on the spike pack. Record: loader installed, client-only mods skipped, overrides extracted, the exact ready log line, and whether the container healthcheck turns `healthy`.
- [ ] **Step 3: Modrinth modpack version API.** Use `npx ctx7@latest` (or Modrinth API docs) to confirm the `POST /version` multipart fields for a **modpack** (`loaders` value for modpacks, `project_id`, `file_parts`, `primary_file`, `version_type`). Record the exact payload shape.
- [ ] **Step 4: ProbeJS output (spike 5) — desk check only.** From KubeJS/ProbeJS docs record where ProbeJS 1.21.1 writes typings and what `jsconfig.json` must reference. Mark "needs in-game confirmation" for the user checkpoint in Task 6.
- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/notes/2026-10-23-spikes.md
git commit -m "docs: record BastionPack verification spikes"
```

---

### Task 2: Strip PanPack leftovers and set up the toolchain

**Files:**
- Delete: `kubejs/dx/`, `kubejs/eslint.config.mjs`, `kubejs/package.json`, `kubejs/package-lock.json`, `kubejs/config/*.properties` (KubeJS 6 format; regenerated), `.github/hooks/`, `.github/workflows/lint.yml`, `.github/workflows/build-release.yml`, `.pakku/server-overrides/*` (Forge server files), `defaultconfigs/ftb*`, `pakku.jar`, `.vscode/pan.code-workspace`
- Create: `mise.toml`, `package.json`, `tsconfig.json`, `.oxlintrc.json`, `.oxfmtrc.json`, `Taskfile.yml` (initial), `.githooks/pre-commit`, `oxlint-plugin/bastion.js`, `oxlint-plugin/fixtures/empty-remove.js`, `oxlint-plugin/bastion.test.ts`, `scripts/lib/errors.ts`, `scripts/lib/errors.test.ts`, `scripts/lib/exec.ts`, `scripts/lib/paths.ts`, `kubejs/server_scripts/example.js`
- Modify: `.gitignore` (add `pakku.jar`, `build/`, `server/data/`, `server/.env`, `.env`, `node_modules/`, probe output), `.gitattributes` (LF rules), `kubejs/jsconfig.json` (ES2015+, point at ProbeJS output per Task 1 notes)

**Interfaces:**
- Produces:
  - `class BastionError extends Error` with fields `hint?: string`, `docs?: string`; `constructor(message: string, opts?: { hint?: string; docs?: string })`.
  - `formatError(e: unknown): string` → `✖ <message>\n  → <hint>\n  docs: <docs>` (lines omitted when absent; non-Bastion errors print message only, stack only when `BASTION_DEBUG=1`).
  - `main(fn: () => Promise<void>): void` — runs `fn`, on error prints `formatError` to stderr and sets `process.exitCode = 1`.
  - `run(cmd: string, args: string[], opts?: { cwd?: string; env?: NodeJS.ProcessEnv; inherit?: boolean }): Promise<{ code: number; stdout: string; stderr: string }>` — never throws on non-zero exit; throws `BastionError` with hint "is <cmd> installed? run `mise install`" on ENOENT.
  - `repoRoot(from?: string): string` — walks up to the dir containing `pakku.json`.
  - Tasks: `test`, `check` (oxfmt --check, oxlint, tsc --noEmit on `scripts/`, `check-docs` added in Task 16), `fix`, `check:types` (KubeJS + ProbeJS, opt-in), `check:staged`, `hooks:install` (`git config core.hooksPath .githooks`).

- [ ] **Step 1: Delete the files listed above** and update `.gitignore`/`.gitattributes`. Run `git status` — expected: only deletions/modifications listed.
- [ ] **Step 2: Add `mise.toml`** (`java = "temurin-21"`, `node = "24"`, `pnpm = "latest"` pinned to the current version, `task = "3"` pinned). Run `mise install` — expected: success.
- [ ] **Step 3: Add `package.json`** (`"type": "module"`, `"private": true`, `packageManager` pinned, devDeps `oxlint`, `oxfmt`, `typescript`, `@types/node`; dep `fflate`) and `tsconfig.json` per Global Constraints, `include: ["scripts", "oxlint-plugin"]`. Run `pnpm install`.
- [ ] **Step 4: Write failing tests `scripts/lib/errors.test.ts`**

```ts
test("formatError prints message, hint and docs", () => {
  const e = new BastionError("pakku.jar not found", { hint: "run `task setup`", docs: "docs/troubleshooting.md#pakku-missing" });
  assert.equal(formatError(e), "✖ pakku.jar not found\n  → run `task setup`\n  docs: docs/troubleshooting.md#pakku-missing");
});
test("formatError on plain Error prints only the message", () => {
  assert.equal(formatError(new Error("boom")), "✖ boom");
});
test("run returns non-zero code instead of throwing", async () => {
  const r = await run(process.execPath, ["-e", "process.exit(3)"]);
  assert.equal(r.code, 3);
});
test("run on missing binary throws BastionError with install hint", async () => {
  await assert.rejects(run("definitely-not-a-binary-xyz", []), (e) => e instanceof BastionError && /mise install/.test(e.hint ?? ""));
});
```

- [ ] **Step 5: Run `node --test scripts/lib/errors.test.ts`** — expected: FAIL (modules missing).
- [ ] **Step 6: Implement `scripts/lib/errors.ts`, `scripts/lib/exec.ts`, `scripts/lib/paths.ts`** with the signatures above.
- [ ] **Step 7: Run the tests** — expected: PASS.
- [ ] **Step 8: Example oxlint JS plugin.** Rule `bastion/no-empty-recipe-remove`: reports `event.remove({})` (empty object literal as the only argument of a `.remove` call) with message `"event.remove({}) removes every recipe in the game. Pass a filter like { output: 'mod:item' }."`. Test `oxlint-plugin/bastion.test.ts` runs `pnpm exec oxlint -c .oxlintrc.json oxlint-plugin/fixtures/empty-remove.js` via `run()` and asserts exit code ≠ 0 and stdout contains `no-empty-recipe-remove`; a second fixture with `event.remove({ output: "minecraft:stick" })` passes. Write test → fail → implement → pass.
- [ ] **Step 9: Configure `.oxlintrc.json`** (`jsPlugins: ["./oxlint-plugin/bastion.js"]`, correctness category on, `no-undef` off for `kubejs/**`, ignore `kubejs/probe/**`, `.probe/**`) and `.oxfmtrc.json` (`tabWidth: 4`, ignore `pakku-lock.json`, `config/**`, `defaultconfigs/**`, probe output). Add `kubejs/server_scripts/example.js` (`// @ts-check`, one commented `ServerEvents.recipes` example).
- [ ] **Step 10: Write `Taskfile.yml`** (version `'3'`) with the tasks in Interfaces and `.githooks/pre-commit` (`#!/bin/sh` → `exec task check:staged`). Run `task check` and `task test` — expected: both pass. Run `task --list` — expected: every task has a `desc`.
- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: replace PanPack tooling with mise, pnpm, oxlint and oxfmt"
```

---

### Task 3: Pinned Pakku and `task setup`

**Files:**
- Create: `scripts/lib/pakku.ts`, `scripts/lib/pakku.test.ts`, `scripts/setup.ts`
- Modify: `Taskfile.yml` (vars `PAKKU_VERSION`, `PAKKU_SHA256`; task `setup`)

**Interfaces:**
- Consumes: `run`, `BastionError`, `repoRoot` (Task 2).
- Produces:
  - `verifySha256(file: string, expected: string): Promise<boolean>`
  - `ensurePakku(opts: { version: string; sha256: string; dest: string; fetchImpl?: typeof fetch }): Promise<"present" | "downloaded">` — if `dest` exists with matching hash → `"present"`; else download `https://github.com/juraj-hrivnak/pakku/releases/download/v<version>/pakku.jar` to `<dest>.part`, verify, rename; on mismatch delete `.part` and throw `BastionError("pakku.jar checksum mismatch", { hint: "re-run `task setup`; if it persists the release asset changed — check PAKKU_SHA256", docs: "docs/troubleshooting.md#pakku-checksum" })`. An existing jar with the wrong hash is replaced (version bump).
  - `pakku(args: string[], opts?: { cwd?: string; inherit?: boolean }): Promise<RunResult>` — runs `java -jar <root>/pakku.jar ...args`; missing jar → `BastionError` hint "run `task setup`", docs `#pakku-missing`.
  - `scripts/setup.ts` CLI: checks `java -version` major ≥ 21 (else error with `mise install` hint), `ensurePakku` with env `PAKKU_VERSION`/`PAKKU_SHA256`, `pakku fetch`, `git config core.hooksPath .githooks`. Prints one line per step. Idempotent.

- [ ] **Step 1: Write failing tests** (`fetchImpl` stub returning bytes; temp dirs)

```ts
test("ensurePakku downloads and verifies", async () => { /* stub returns known bytes, sha256 matches */ assert.equal(await ensurePakku(opts), "downloaded"); });
test("ensurePakku returns present when hash matches", async () => { assert.equal(await ensurePakku(opts), "present"); });
test("checksum mismatch deletes the partial file and throws", async () => {
  await assert.rejects(ensurePakku({ ...opts, sha256: "0".repeat(64) }), /checksum mismatch/);
  assert.equal(existsSync(opts.dest + ".part"), false);
  assert.equal(existsSync(opts.dest), false);
});
test("existing jar with old hash is replaced", async () => { /* write junk to dest */ assert.equal(await ensurePakku(opts), "downloaded"); });
```

- [ ] **Step 2: Run** `node --test scripts/lib/pakku.test.ts` — expected: FAIL.
- [ ] **Step 3: Implement `scripts/lib/pakku.ts` and `scripts/setup.ts`.** Get the real SHA-256 of the pinned release asset and put it in `Taskfile.yml`.
- [ ] **Step 4: Run tests** — PASS. Run `task setup` twice — expected: second run says Pakku `present` and finishes without downloading.
- [ ] **Step 5: Commit** — `git commit -m "feat: pin Pakku and add task setup"`

---

### Task 4: Pakku config for 1.21.1 NeoForge + base modset

**Files:**
- Modify: `pakku.json`, `pakku-lock.json` (regenerated by Pakku, never by hand)
- Create: `scripts/lib/lock.ts`, `scripts/lib/lock.test.ts`

**Interfaces:**
- Produces:
  - `type ProjectSide = "CLIENT" | "SERVER" | "BOTH"`
  - `type PakkuLock = { target: string; mc_versions: string[]; loaders: Record<string, string>; projects: LockProject[] }`, `type LockProject = { pakku_id: string; type: string; side?: ProjectSide; slug: Record<string, string>; name: Record<string, string>; id: Record<string, string>; files: unknown[] }`
  - `type PakkuConfig = { name: string; version: string; description?: string; author?: string; overrides?: string[]; server_overrides?: string[]; client_overrides?: string[]; projects?: Record<string, { side?: ProjectSide; export?: boolean; update_strategy?: string; redistributable?: boolean }>; export_server_side_projects_to_client?: boolean }`
  - `readLock(root: string): PakkuLock`, `readConfig(root: string): PakkuConfig`, `writeConfig(root: string, cfg: PakkuConfig): void` (4-space JSON + trailing newline, key order preserved).

- [ ] **Step 1: Write failing tests** for `readConfig`/`writeConfig` round-trip (unchanged bytes for the committed `pakku.json`) and `readLock` returning `target === "modrinth"`, `mc_versions[0] === "1.21.1"`, `"neoforge" in loaders`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Rebuild the lock with Pakku:** remove old lock, `pakku init` (name "BastionPack", target modrinth, mc 1.21.1, loader neoforge latest stable 21.1.x), then `pakku add sodium modernfix ferrite-core immediatelyfast entityculling noisium kubejs probejs jei jade` (add `crash-assistant`, `spark` only if they resolve cleanly — §4.3). Verify each resolved for 1.21.1 NeoForge.
- [ ] **Step 4: Write `pakku.json`:** `version: "0.0.0-dev"`, `overrides: ["config", "defaultconfigs", "kubejs", "!kubejs/probe/**"]`, side-specific KubeJS per #141 workaround (no `!` exclusions relying on the base list), `projects.probejs: { side: "CLIENT", export: false }`, client-only sides for Sodium/EntityCulling/ImmediatelyFast if Modrinth reports them wrong, `export_server_side_projects_to_client: false`. No path in both `overrides` and `.pakku/server-overrides/` (#120).
- [ ] **Step 5: Implement `scripts/lib/lock.ts`**; run tests — PASS.
- [ ] **Step 6: Verify:** `java -jar pakku.jar status` — no errors; `java -jar pakku.jar export` — `build/modrinth/*.mrpack` exists.
- [ ] **Step 7: Commit** — `git commit -m "feat: target Modrinth 1.21.1 NeoForge with base modset"`

---

### Task 5: `task build`

**Files:**
- Create: `scripts/lib/semver.ts`, `scripts/lib/semver.test.ts`, `scripts/lib/version.ts`, `scripts/lib/version.test.ts`, `scripts/lib/mrpack.ts`, `scripts/lib/mrpack.test.ts`, `scripts/build.ts`, `scripts/build.test.ts`
- Modify: `Taskfile.yml` (`build`)

**Interfaces:**
- Consumes: `pakku()`, `readConfig`/`writeConfig`.
- Produces:
  - `scripts/lib/semver.ts`: `isSemver(v: string): boolean` — `MAJOR.MINOR.PATCH` with optional `-pre`, **no** `v` prefix; `compareSemver(a: string, b: string): number` (prerelease < release); `previousReleaseTag(tags: string[], current?: string): string | null` — greatest semver tag strictly below `current` (or overall when absent), non-semver tags ignored; `isPrerelease(v: string): boolean`.
  - `devVersion(input: { lastTag: string | null; sha: string }): string` → `${lastTag ?? "0.0.0"}-dev+${sha.slice(0, 7)}`
  - `type MrpackIndex = { formatVersion: number; name: string; versionId: string; dependencies: Record<string, string>; files: { path: string; env?: { client: string; server: string } }[] }`
  - `readMrpackIndex(file: string): Promise<MrpackIndex>`; `listOverrides(file: string): Promise<string[]>` (entries under `overrides/`, `client-overrides/`, `server-overrides/`).
  - `build(opts: { root: string; version: string; serverpack: boolean; pakkuRunner?: typeof pakku }): Promise<{ mrpack: string; serverpack?: string }>` — sets version with `pakku cfg -v <version>`, runs `pakku export` (`--no-server` unless `serverpack`), restores the original `pakku.json` bytes in `finally`, returns paths; throws `BastionError` (docs `#export-failed`) if no `.mrpack` is produced.
  - CLI: `task build` (dev version from `previousReleaseTag(git tag --list)` + `git rev-parse HEAD`), `task build VERSION=x.y.z`, `SERVERPACK=true` env/var enables the serverpack zip.

- [ ] **Step 1: Write failing tests** (semver tests below plus these)

```ts
test("previousReleaseTag ignores non-semver tags", () => assert.equal(previousReleaseTag(["v0.1.0", "latest", "1.3.3x", "0.1.0", "0.2.0"], "0.3.0"), "0.2.0"));
test("previousReleaseTag with no tags", () => assert.equal(previousReleaseTag([], "0.1.0"), null));
test("prerelease sorts before release", () => assert.ok(compareSemver("1.0.0-beta.1", "1.0.0") < 0));
test("devVersion without tags", () => assert.equal(devVersion({ lastTag: null, sha: "abcdef1234" }), "0.0.0-dev+abcdef1"));
test("devVersion after a release", () => assert.equal(devVersion({ lastTag: "0.2.0", sha: "abcdef1234" }), "0.2.0-dev+abcdef1"));
test("build restores pakku.json when export fails", async () => {
  // temp repo dir named "Engineer's Tea" containing pakku.json; fake pakkuRunner fails on "export"
  await assert.rejects(build({ root, version: "1.0.0", serverpack: false, pakkuRunner: failingExport }), /export/i);
  assert.equal(readFileSync(join(root, "pakku.json"), "utf8"), original);
});
test("build returns the mrpack path from a root with spaces", async () => { /* fake runner writes build/modrinth/x.mrpack */ });
test("readMrpackIndex reads dependencies", async () => { /* fixture mrpack made with fflate.zipSync */ assert.equal(index.dependencies.minecraft, "1.21.1"); });
```

- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** the three modules.
- [ ] **Step 4: Run tests** — PASS. Run `task build` — expected: `.mrpack` path printed, `git status` clean.
- [ ] **Step 5: Commit** — `git commit -m "feat: add task build with dev versions"`

---

### Task 6: Prism instance tasks

**Files:**
- Modify: `.pakku/prism-overrides/instance.cfg`, `.pakku/prism-overrides/mmc-pack.json`
- Create: `scripts/prism.ts`, `scripts/prism.test.ts`
- Modify: `Taskfile.yml` (`setup:prism`, `prism:sync`)

**Interfaces:**
- Consumes: `readLock`, `readConfig`, `BastionError`.
- Produces:
  - `checkInstanceLayout(repoDir: string): { ok: true; instanceDir: string } | { ok: false; reason: string }` — ok when `basename(repoDir)` is `minecraft` or `.minecraft` and the parent contains `instance.cfg` **or** is empty-of-instance-files and its parent is named `instances`.
  - `renderMmcPack(lock: PakkuLock): object` — components `org.lwjgl3` (version required by MC 1.21.1), `net.minecraft` = `mc_versions[0]`, `net.neoforged` = `loaders.neoforge`; `formatVersion: 1`.
  - `renderInstanceCfg(name: string): string` — `[General]`, `name=<name>`, `InstanceType=OneSix`, `OverrideCommands=true`, `PreLaunchCommand="$INST_JAVA" -jar pakku.jar fetch` (exact form adjusted after the checkpoint).
  - `task setup:prism` → validate layout (error docs `#prism-layout` explaining "clone into `<Prism>/instances/<name>/minecraft`"), write `instance.cfg` (name from `pakku.json`) and `mmc-pack.json` into the instance dir. `task prism:sync` → rewrite only `mmc-pack.json`. Also export `mmcPackMatches(instanceDir: string, lock: PakkuLock): boolean` for doctor.

- [ ] **Step 1: Write failing tests**: layout ok for `…/instances/Engineer's Tea/minecraft` (temp dirs), rejected for `…/workspace/js/PanPack` with reason mentioning `instances/<name>/minecraft`; `renderMmcPack` neoforge uid `net.neoforged` + versions from a fixture lock; `renderInstanceCfg("Engineer's Tea")` contains `name=Engineer's Tea` and the PreLaunchCommand line.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: USER CHECKPOINT (spike 6 + Done-1).** Ask the user to clone the branch into a Prism instance folder, run `mise install`, `task setup`, `task setup:prism`, then Play. Confirm: prelaunch fetch runs (Windows, no shell wrapper), game reaches the main menu, `/probejs dump` output location (spike 5). Record results in the spikes notes; fix `renderInstanceCfg`/`jsconfig.json` if needed.
- [ ] **Step 6: Commit** — `git commit -m "feat: add Prism instance setup and sync tasks"`

---

### Task 7: Modrinth client and `mods:*` tasks

**Files:**
- Create: `scripts/lib/modrinth.ts`, `scripts/lib/modrinth.test.ts`, `scripts/mods.ts`, `scripts/mods.test.ts`
- Modify: `Taskfile.yml` (`mods:find`, `mods:add`, `mods:rm`, `mods:update`)

**Interfaces:**
- Consumes: `pakku()`, `readLock`, `BastionError`.
- Produces:
  - `type ModrinthProject = { id: string; slug: string; title: string; downloads: number; client_side: string; server_side: string; updated: string; license: { id: string } }`
  - `type SearchHit = { slug: string; title: string; downloads: number; date_modified: string; client_side: string; server_side: string }`
  - `createModrinthClient(opts: { userAgent: string; baseUrl?: string; token?: string; fetchImpl?: typeof fetch }): ModrinthClient` with
    `search(query: string, f: { gameVersion: string; loader: string; limit?: number }): Promise<SearchHit[]>` (facets `[["project_type:mod"],["versions:<v>"],["categories:<loader>"]]`),
    `getProjects(idsOrSlugs: string[]): Promise<ModrinthProject[]>` (`/projects?ids=`),
    `listVersions(project: string, f?: { gameVersion?: string; loader?: string }): Promise<{ id: string; version_number: string }[]>`,
    `createVersion(form: FormData): Promise<{ id: string }>` (used by Task 10).
    Errors: network → `BastionError("Can't reach Modrinth", { hint: "check your connection or https://status.modrinth.com", docs: "docs/troubleshooting.md#modrinth-unreachable" })`; 429 → hint "rate limited, wait a minute"; 401/403 → hint "check MODRINTH_TOKEN scopes"; 5xx → hint "Modrinth is having trouble, retry later".
  - `formatSearchTable(hits: SearchHit[]): string` — columns slug, title, downloads, updated (YYYY-MM-DD), side (`client`/`server`/`both`).
  - CLI: `task mods:find -- <query>` (MC/loader read from lock); `mods:add -- <mods…>` / `mods:rm -- <mods…>` / `mods:update [-- <mods…>]` copy the lock to `build/.lock-before.json`, run Pakku, then print `pakku diff build/.lock-before.json pakku-lock.json`.

- [ ] **Step 1: Write failing tests** with a stub `fetchImpl`: search sends the facets and `User-Agent`; 429 → BastionError with "rate limited" hint; `fetch` rejection → "Can't reach Modrinth"; `formatSearchTable` aligns columns and maps `required/unsupported` to `client`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Verify live:** `task mods:find -- farming` — table of 1.21.1 NeoForge mods.
- [ ] **Step 6: Commit** — `git commit -m "feat: add Modrinth client and mods tasks"`

---

### Task 8: `task doctor`

**Files:**
- Create: `scripts/doctor.ts`, `scripts/doctor.test.ts`
- Modify: `Taskfile.yml` (`doctor`)

**Interfaces:**
- Consumes: `readLock`, `readConfig`, `createModrinthClient`, `verifySha256`, `checkInstanceLayout`, `mmcPackMatches`, `run`.
- Produces:
  - `type Finding = { level: "ok" | "warn" | "error"; message: string; docs?: string }`
  - `compareSides(lock: PakkuLock, config: PakkuConfig, mr: ModrinthProject[]): Finding[]` — for each Modrinth project, expected side = `CLIENT` if server `unsupported`, `SERVER` if client `unsupported`, else `BOTH`; effective side = `config.projects[slug].side ?? lockProject.side ?? "BOTH"`; mismatch → `warn` with the exact `pakku.json` snippet to add, docs `docs/guides/wrong-mod-side.md`.
  - `findDuplicateOverrides(root: string, config: PakkuConfig): Finding[]` — files present both under a path matched by `overrides` and under `.pakku/server-overrides/` → `warn` (#120).
  - `checkConfigProjects(lock: PakkuLock, config: PakkuConfig): Finding[]` — keys in `config.projects` matching no lock project slug/name/id → `warn`.
  - Tool checks: Java ≥ 21, Node ≥ 24, pnpm/task present, `pakku.jar` hash = pinned, Prism instance `mmc-pack.json` matches lock (only when layout ok).
  - CLI prints `✔`/`!`/`✖` per finding with docs link; exit 1 only if any `error`. Modrinth unreachable → single `warn`, other checks still run.

- [ ] **Step 1: Write failing tests**: a lock where Sodium has side `BOTH` and Modrinth says server `unsupported` → one `warn` containing `"sodium": { "side": "CLIENT" }`; same with a config override already `CLIENT` → no finding; duplicate override fixture → warn naming the file; stale `config.projects.oldmod` → warn.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS. Run `task doctor` — every line has a status mark; exit 0 on the template.
- [ ] **Step 5: Commit** — `git commit -m "feat: add task doctor"`

---

### Task 9: Changelog and `task release`

**Files:**
- Create: `scripts/lib/changelog.ts`, `scripts/lib/changelog.test.ts`, `scripts/release.ts`, `scripts/release.test.ts`
- Modify: `CHANGELOG.md` (Keep a Changelog header + empty `## [Unreleased]`), `Taskfile.yml` (`release`)

**Interfaces:**
- Consumes: `isSemver`, `compareSemver`, `previousReleaseTag` (Task 5), `BastionError`.
- Produces:
  - `extractSection(md: string, version: string): string | null` — body of `## [<version>]` (case-insensitive for `Unreleased`), trimmed.
  - `promoteUnreleased(md: string, version: string, isoDate: string): string` — inserts `## [<version>] - <isoDate>` with the Unreleased body and leaves an empty `## [Unreleased]`; throws `BastionError` if Unreleased is empty (docs `#release-empty-changelog`) or the version exists.
  - `validateRelease(s: { version: string; branch: string; clean: boolean; tags: string[]; changelog: string }): void` — throws BastionError for: not semver, branch ≠ `main`, dirty tree, tag exists, version ≤ previous release, empty Unreleased.
  - CLI `task release -- x.y.z`: validate → promote → commit `chore: release x.y.z` → tag `x.y.z` → `git push --atomic origin main x.y.z`.

- [ ] **Step 1: Write failing tests**

```ts
test("promoteUnreleased moves entries", () => { /* fixture md → contains "## [0.2.0] - 2026-10-23" and empty Unreleased */ });
test("promoteUnreleased refuses empty Unreleased", () => assert.throws(() => promoteUnreleased(emptyMd, "0.2.0", "2026-10-23"), /Unreleased/));
test("validateRelease rejects a dirty tree", () => assert.throws(() => validateRelease({ ...ok, clean: false }), /uncommitted/));
test("validateRelease rejects non-main branch", () => assert.throws(() => validateRelease({ ...ok, branch: "dev" }), /main/));
test("validateRelease rejects version not above previous", () => assert.throws(() => validateRelease({ ...ok, version: "0.1.0", tags: ["0.2.0"] }), /greater/));
```

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: add changelog handling and task release"`

---

### Task 10: `task publish:modrinth`

**Files:**
- Create: `scripts/publish-modrinth.ts`, `scripts/publish-modrinth.test.ts`, `.env.example` (root: `MODRINTH_TOKEN=`, `MODRINTH_PROJECT_ID=`)
- Modify: `Taskfile.yml` (`publish:modrinth`, `dotenv: [".env"]`)

**Interfaces:**
- Consumes: `createModrinthClient`, `readMrpackIndex`, `extractSection`, `isPrerelease`, `BastionError`.
- Produces:
  - `buildVersionPayload(i: { projectId: string; version: string; name: string; changelog: string; gameVersion: string; loader: string; fileName: string }): Record<string, unknown>` — fields exactly as recorded in Task 1 Step 3; `version_type` = `alpha` if `-alpha`, `beta` if `-beta` / other prerelease, else `release`; `primary_file` = `fileName`.
  - `publishModrinth(o: { mrpack: string; version: string; projectId: string; token?: string; dryRun: boolean; client: ModrinthClient; changelog: string }): Promise<{ status: "dry-run" | "published" | "skipped"; versionId?: string }>` — no token or project id → `"skipped"` (prints notice); version_number already on the project → `BastionError("version x.y.z already exists on Modrinth")`; dry-run prints payload + file size, sends nothing.
  - CLI: `task publish:modrinth -- [--dry-run] [--version x.y.z]` (defaults: version from latest tag, mrpack from `build/modrinth/`).

- [ ] **Step 1: Write failing tests**: payload for `1.0.0-beta.2` has `version_type: "beta"`, `game_versions: ["1.21.1"]`; dry-run never calls `createVersion` (spy); existing version → rejects; missing token → `skipped`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS. Run `task build` then `task publish:modrinth -- --dry-run --version 0.0.1` — payload printed, nothing sent.
- [ ] **Step 5: Commit** — `git commit -m "feat: add Modrinth publish script with dry run"`

---

### Task 11: Local server (Docker + playit) and smoke test

**Files:**
- Create: `server/compose.yaml`, `server/.env.example`, `scripts/smoke.ts`, `scripts/smoke.test.ts`
- Modify: `Taskfile.yml` (`server:up`, `server:down`, `server:logs`, `server:update`, `server:smoke`)

**Interfaces:**
- Consumes: `build()`, `run()`, `BastionError`.
- Produces:
  - `isReadyLine(line: string): boolean` — matches the ready line recorded in Task 1 (NeoForge: `Done (<n>s)! For help, type "help"`).
  - `failureContext(log: string, maxLines?: number): string` — last 60 lines plus any `crash-reports/*` path mentioned.
  - `smoke(o: { mrpack: string; image: string; timeoutMs: number }): Promise<void>` — `docker run -d` itzg (`TYPE=MODRINTH`, `EULA=TRUE`, `MEMORY=3G`, mrpack bind-mounted read-only at `/modpacks/`), streams logs until `isReadyLine` or exit/timeout (default 15 min), always `docker rm -f`; failure → `BastionError` with `failureContext`, docs `#server-smoke-failed`.
  - `compose.yaml`: services `minecraft` (`itzg/minecraft-server` pinned tag, `TYPE=MODRINTH`, `EULA=TRUE`, `MEMORY=${MEMORY:-4G}`, `MODRINTH_MODPACK=${MODRINTH_MODPACK}`, `MODRINTH_VERSION=${MODRINTH_VERSION:-}`, `MODRINTH_EXCLUDE_FILES=${MODRINTH_EXCLUDE_FILES:-}`, volumes `./data:/data`, `../build/modrinth:/modpacks:ro`, port `25565`) and `playit` (official playit agent image pinned, `SECRET_KEY=${PLAYIT_SECRET_KEY}`, networking per Task 1/checkpoint).
  - `.env.example` documents `MODRINTH_MODPACK` (local `/modpacks/<file>.mrpack` or published slug), `MODRINTH_VERSION`, `MEMORY`, `PLAYIT_SECRET_KEY`, `MODRINTH_EXCLUDE_FILES`.
  - Tasks: `server:up` (local mode: `build` then compose up with the newest mrpack), `server:update` (pull + recreate with `MODRINTH_FORCE_SYNCHRONIZE=true`), `server:smoke` (`smoke()` on the newest build).

- [ ] **Step 1: Write failing tests** for `isReadyLine` (real NeoForge line → true; `Done preparing level` → false) and `failureContext` (keeps last N lines, extracts crash report path).
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS. Run `task server:smoke` — expected: passes on the base modset.
- [ ] **Step 5: USER CHECKPOINT (spike 4 + Done-3).** User fills `server/.env` with their existing playit secret, runs `task server:up`, joins from Prism through the playit address. Adjust `playit` networking if needed; record in spikes notes.
- [ ] **Step 6: Commit** — `git commit -m "feat: add local Docker server and smoke test"`

---

### Task 12: `ci.yml` and build summary

**Files:**
- Create: `.github/workflows/ci.yml`, `scripts/summary.ts`, `scripts/summary.test.ts`

**Interfaces:**
- Consumes: `readMrpackIndex`, `previousReleaseTag`, `pakku()`, tasks `check`, `test`, `build`, `server:smoke`.
- Produces:
  - `renderSummary(i: { name: string; version: string; mc: string; loader: string; modCount: number; diff: string | null }): string` — Markdown; `diff === null` → line `No previous release tag — this is the first build.`
  - CLI `scripts/summary.ts` writes to `$GITHUB_STEP_SUMMARY` (stdout locally); diff = `pakku diff --markdown` between `git show <prevTag>:pakku-lock.json` and the current lock.
  - `ci.yml`: on `push: main`, `pull_request`; `permissions: contents: read`; job: checkout (`fetch-depth: 0`) → `jdx/mise-action` (pinned) → `pnpm install --frozen-lockfile` → `task setup` → `task check` → `task test` → `task build` → upload `build/modrinth/*.mrpack` artifact → `task server:smoke` → summary. Cache `~/.pakku` / `build/.cache` keyed on `pakku-lock.json` hash.

- [ ] **Step 1: Write failing tests** for `renderSummary` (first build line; diff block when present; mod count).
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** summary + workflow. **Step 4: Run** — PASS; validate workflow syntax with `actionlint` (via `mise exec aqua:rhysd/actionlint -- actionlint` or pnpm dlx) — no errors.
- [ ] **Step 5: Commit** — `git commit -m "ci: add build, check and server smoke workflow"`

---

### Task 13: `release.yml`

**Files:**
- Create: `.github/workflows/release.yml`, `scripts/release-notes.ts`, `scripts/release-notes.test.ts`

**Interfaces:**
- Consumes: `extractSection`, `previousReleaseTag`, `isPrerelease`, `build`, `publishModrinth`, `smoke`.
- Produces:
  - `buildReleaseNotes(i: { changelogSection: string; diffMarkdown: string | null }): string` — changelog section, then `## Mod changes` + diff, or `First release — no previous version to compare.`
  - `release.yml`: on `push: tags: ['[0-9]+.[0-9]+.[0-9]+*']`; `permissions: contents: write`; steps: mise → setup → `task build VERSION=${{ github.ref_name }}` (+ `SERVERPACK=${{ vars.BUILD_SERVERPACK == 'true' }}`) → `task server:smoke` → notes → `softprops/action-gh-release` (pinned) with `.mrpack` (+ serverpack zip when enabled), `prerelease` from `isPrerelease` → `task publish:modrinth -- --version <tag>` (secrets/vars passed as env; skips itself with notice when absent) → Discord step: `if: env.DISCORD_WEBHOOK != ''` posting name, version, Modrinth/GitHub links via `curl` → CurseForge step gated by `vars.ENABLE_CURSEFORGE == 'true'` and `secrets.CURSEFORGE_TOKEN` using `Xikaro/upload-curseforge-modpack-action` (pinned) with `vars.CURSEFORGE_ID` (requires target `multiplatform`, see `docs/guides/enable-curseforge.md`).

- [ ] **Step 1: Write failing tests** for `buildReleaseNotes` (with and without diff).
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** notes script + workflow. **Step 4: Run** — PASS; `actionlint` clean.
- [ ] **Step 5: Commit** — `git commit -m "ci: add tag-driven release workflow"`

---

### Task 14: `mod-updates.yml` and Dependabot

**Files:**
- Create: `.github/workflows/mod-updates.yml`, `.github/dependabot.yml`

**Interfaces:**
- Consumes: `pakku()`, tasks `build`, `server:smoke`, `summary.ts` diff logic.
- Produces:
  - `mod-updates.yml`: `schedule: cron "0 6 * * 1"` + `workflow_dispatch`; `permissions: contents: write, pull-requests: write`; steps: mise → setup → copy lock → `java -jar pakku.jar update -a` → if `git diff --quiet pakku-lock.json` stop with notice "No mod updates" → `task build` → `task server:smoke` (`continue-on-error: true`, outcome captured) → body = `pakku diff --markdown` + `Server smoke test: ✅ passed / ❌ failed (see run <url>)` → `peter-evans/create-pull-request` (pinned) on branch `bot/mod-updates`, title `chore(mods): weekly mod updates`, token `secrets.BOT_TOKEN || github.token` (note in workflow comment why).
  - `dependabot.yml`: ecosystems `github-actions` and `npm`, weekly.

- [ ] **Step 1: Write both files.** **Step 2: Verify** with `actionlint` — clean. (End-to-end run happens in Task 17.)
- [ ] **Step 3: Commit** — `git commit -m "ci: add weekly mod update PR and Dependabot"`

---

### Task 15: `task init`

**Files:**
- Create: `scripts/init.ts`, `scripts/init.test.ts`
- Modify: `Taskfile.yml` (`init`, `interactive: true`)

**Interfaces:**
- Consumes: `readConfig`, `writeConfig`, `renderInstanceCfg`.
- Produces:
  - `type InitAnswers = { name: string; author: string; description: string; modrinthSlug?: string }`
  - `applyInit(root: string, a: InitAnswers): void` — writes `pakku.json` name/author/description, `version: "0.0.0-dev"`; rewrites `.pakku/prism-overrides/instance.cfg` name; resets `CHANGELOG.md` to header + empty Unreleased; deletes `docs/superpowers/`; replaces README title/intro with a pack README stub that keeps a "Built with BastionPack" section.
  - CLI prompts with `node:readline/promises` (or reads `--name … --author …` flags for non-interactive use); refuses to run twice (detects `name !== "BastionPack"`) unless `--force`.

- [ ] **Step 1: Write failing tests** on a temp copy: after `applyInit` with name `Engineer's Tea`, `pakku.json` name matches, `docs/superpowers` gone, CHANGELOG has only Unreleased, instance.cfg has `name=Engineer's Tea`; second run without force throws.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: add task init for new packs"`

---

### Task 16: Documentation, AGENTS.md and docs check

**Files:**
- Create: `AGENTS.md`, `CONTRIBUTING.md`, every page in spec §4.9 under `docs/`, `.github/PULL_REQUEST_TEMPLATE.md`, `scripts/check-docs.ts`, `scripts/check-docs.test.ts`
- Modify: `README.md` (rewrite), `.github/ISSUE_TEMPLATE/bug_report.yml` (pack version, launcher, client/server, mclo.gs log link), `.github/ISSUE_TEMPLATE/feature.yml`, `LICENSE.md` (keep LGPL-3.0 text; add BastionPack/PanPack attribution header in README, not in license text), `Taskfile.yml` (`check` gains `check-docs`)

**Interfaces:**
- Consumes: every task name from `Taskfile.yml`; troubleshooting anchors used by `BastionError.docs` across Tasks 2–13.
- Produces:
  - `findBrokenLinks(root: string, files: string[]): { file: string; link: string }[]` — relative Markdown links and `#anchors` (GitHub slug rules) that don't resolve.
  - `findUnknownTasks(text: string, taskNames: string[]): string[]` — `task <name>` mentions not in the Taskfile (task names from `task --list-all --json`).
  - `findMissingAnchors(root: string, anchors: string[]): string[]` — every `docs/troubleshooting.md#…` referenced in `scripts/**/*.ts` exists.
  - Page rules (§4.9): one topic, starts with "Use this when…", ends with "Verify it worked"; commands are `task …`. `docs/reference/pakku.md` condenses the Pakku commands/config used here (facts in spec §3). `AGENTS.md` contains: repo map, task list, rules (never hand-edit `pakku-lock.json`; use `task`; run `task check` + `task test` + `task build` before claiming done; docs locations; Pakku reference path).
  - Guide `mod-not-on-modrinth.md` is written from Task 1 spike 1 results; `kubejs-recipes-and-optional-compat.md` includes the `Platform.isLoaded` pattern; `performance-low-end.md` covers the base modset and Java memory.

- [ ] **Step 1: Write failing tests** for the three checkers with fixture files (broken relative link, missing anchor, unknown `task foo`).
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** `check-docs.ts`; **Step 4: Run** — PASS.
- [ ] **Step 5: Write all docs pages**, README, AGENTS.md, CONTRIBUTING, templates.
- [ ] **Step 6: Run `task check`** — expected: docs check passes (no broken links, unknown tasks, or missing anchors).
- [ ] **Step 7: Commit** — `git commit -m "docs: add BastionPack docs, AGENTS.md and docs check"`

---

### Task 17: Publish the repository and run the end-to-end checks

**Files:** none new (repository operations).

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Final local gate:** `task check`, `task test`, `task build`, `task server:smoke`, `task doctor` — all pass.
- [ ] **Step 2: Clean history:** `git switch --orphan main-clean` from the `bastionpack` tree, single commit `feat: BastionPack template` (with attribution trailer). Do **not** push PanPack tags.
- [ ] **Step 3: Create repo** (user granted permission): `gh repo create marr-cloud/BastionPack --public --description "Modrinth-first modpack template: reliable, robust, easy to troubleshoot"`; `git remote rename origin upstream`; `git remote add origin https://github.com/marr-cloud/BastionPack`; `git push -u origin main-clean:main` (no `--tags`); `gh repo edit marr-cloud/BastionPack --template`.
- [ ] **Step 4: Done-4:** `gh run watch` on the first `ci.yml` run — green, summary shows "first build".
- [ ] **Step 5: Done-5:** add a line under `## [Unreleased]`, commit, `task release -- 0.1.0`; watch `release.yml` — GitHub Release with `.mrpack` and notes ("First release…"), Modrinth step skipped with notice. Run `task publish:modrinth -- --dry-run --version 0.1.0` locally — passes.
- [ ] **Step 6: Done-6:** `gh workflow run mod-updates.yml`; watch — PR opened or "No mod updates" notice.
- [ ] **Step 7: Done-7:** confirm every task in §4.5 and page in §4.9 exists (`task --list`, `task check`).
- [ ] **Step 8: Report** results to the user, including the outstanding manual item: first real Modrinth upload happens with their first pack (Engineer's Tea).
