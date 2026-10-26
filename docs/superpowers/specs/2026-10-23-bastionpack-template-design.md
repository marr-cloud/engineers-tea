# BastionPack — modpack template design

Date: 2026-10-23
Status: draft, awaiting approval
Starting point: this repository, a clone of [ThePansmith/PanPack](https://github.com/ThePansmith/PanPack) (LGPL-3.0)

Decisions are marked **(user)** when the user decided them in conversation and
**(call)** when they are the designer's call that the user has not explicitly
confirmed. Anything not marked is a constraint or a fact.

---

## 1. Intent

BastionPack is a modpack template for Minecraft packdevs who publish on
**Modrinth**. Its promise is in the name: **reliable, robust, and easy to
troubleshoot**. When something goes wrong — a mod that won't download, a
mod with the wrong side, a broken server pack, a failed release — the
template should make it obvious what happened and how to fix it.

It comes "batteries included": clone, run one setup command, open Prism,
press Play. Adding a mod, testing it, and shipping a release are each one
command.

It is built first for the user's own packs (the first one is
"Engineer's Tea", a relaxed Create pack played with friends on a home
server) and later published for other packdevs. **(user)**

### Why

PanPack works but is CurseForge-centric and fragile:

- Modrinth support is commented out, and the commented upload step even uses
  the CurseForge action (`Xikaro/upload-curseforge-modpack-action`).
- The first workflow run fails when no tag exists.
- `secrets.discord-webhook` is not a valid secret name (secret names can't
  contain `-`), so the Discord notification likely never ran.
- `.github/hooks/pre-commit` `cd`s into `tools/build`, which doesn't exist.
- `pakku.jar` is committed, but CI downloads "latest" — local and CI versions
  drift.
- Many `# Change this!` edits (owner, branches, names, URLs) must be made by
  hand in the workflow.
- Lint rules are GregTech-specific, and the formatting rule `recipe-spacing`
  would fight a real formatter.
- CI auto-commits lint fixes and `mmc-pack.json` updates to the branch.

The user's real-world pain: in a past attempt with CABIN (a PanPack-based
pack) on a server, joining from the Modrinth client failed with mod-mismatch
errors. BastionPack must make that class of failure impossible by
construction.

## 2. Goals, non-goals, anti-goals

### Goals

1. Modrinth-first: the exported `.mrpack` is the primary artifact. **(user)**
2. One source of truth: client pack and server are built from the same
   `pakku-lock.json`, in the same build, from the same `.mrpack`.
3. One entry point for every action: `task <name>`, discoverable with
   `task --list`.
4. Fast onboarding: fresh clone → `mise install` → `task setup` → Prism Play.
5. Releases are one command (`task release -- x.y.z`) and CI does the rest,
   including a real server boot test before publishing.
6. Mod updates arrive as a weekly PR with a readable diff and a server boot
   result. **(user)**
7. Documentation in English that is short, task-oriented, and equally usable
   by humans and AI agents. **(user)**
8. Zero "Change this!" edits: everything is derived from `pakku.json`, the
   repository context, or GitHub variables/secrets.

### Non-goals

- CurseForge as a primary target. It stays supported but **off by default**. **(user)**
- Multi-version or multi-loader packs in one repo.
- Automated headless *client* testing.
- A docs website (VitePress etc.) for now. **(call)**
- Auto-merging mod updates.
- Keeping PanPack's GregTech-specific lint rules.

### Anti-goals (would be a failure even if it "works")

- Any step that fails silently or with an unexplained error. Every failure
  path prints what's wrong and what to do (or links the troubleshooting doc).
- A missing optional secret (Modrinth token, Discord webhook) failing a build.
  Missing optional config → skip with a clear notice.
- Requiring a CurseForge API key for a Modrinth-only pack.
- A template that only works on the author's machine (Windows-only commands,
  hard-coded paths).
- Client and server mod lists that can diverge.

## 3. Constraints and facts

### Platform and version **(user)**

- Minecraft **1.21.1**, loader **NeoForge**. Chosen after checking Modrinth:
  on 1.21.1 NeoForge the planned mods are all correctly tagged, while on
  1.20.1 NeoForge most mods are tagged `forge` only (JEI, EMI, Mystical
  Agriculture, Waystones, AppleSkin, Spark, Xaero's Minimap return no
  NeoForge 1.20.1 versions), and Pakku filters by loader.
- Java 21.

### Pakku (v1.5.0 latest release, 2026-07-18)

Pakku is not indexed in Context7; the authoritative docs are in the Pakku
repo under `docs/topics/` (rendered at https://juraj-hrivnak.github.io/Pakku/).
Relevant facts:

- `pakku-lock.json` `target`: `curseforge` | `modrinth` | `multiplatform`.
- `pakku export` writes `build/modrinth/*.mrpack`, `build/curseforge/*.zip`
  (if target includes CF) and `build/serverpack/*.zip`. `--no-server` skips
  the serverpack. Export no longer depends on `fetch` (Unreleased).
- In multiplatform packs, a project not on the current platform is included
  as an override if `redistributable`, otherwise dropped.
- `pakku.json` per-project props: `type`, `side` (`CLIENT|SERVER|BOTH`),
  `update_strategy` (`LATEST|FLEXVER|NONE`), `redistributable`, `subpath`,
  `aliases`, `export`. Top-level `export_server_side_projects_to_client`
  (default false; Modrinth gets `env.client = "unsupported"` for SERVER mods).
- `pakku cfg -v <version>` sets the version (replaces PanPack's `sed` on `DEV`).
- `pakku diff --markdown` produces the changelog diff between two locks.
- `pakku fetch --shelve`, `pakku sync`, `pakku status`, `pakku insp`,
  `pakku update -a` exist. `GITHUB_ACCESS_TOKEN` env raises GitHub API limits.
- `pakku fork` (new) lets a pack inherit a parent pack — noted for the
  future, not used in v1.

Known Pakku issues the template must design around:

| Issue | Problem | Template mitigation |
|---|---|---|
| #131 | Modrinth side detection wrong for mods with multiple environments. Fixed only in *Unreleased*. | `task doctor` cross-checks lock sides against the Modrinth API (`client_side`/`server_side`/`environment`) and prints suggested `pakku.json` side overrides. Bump Pakku when the fix is released. |
| #141 | `!` exclusions in `client_overrides`/`server_overrides` don't apply to paths included by `overrides`. | Default `pakku.json` lists side-specific KubeJS folders fully in each side list (documented duplication), with a comment in docs. |
| #120 | Same path in `overrides` and `.pakku/server-overrides/` → nondeterministic winner. | Template never ships a path in both; `task doctor` warns if it finds one. |
| #142 | Lock merge conflicts have no regeneration path. | Guide: resolve by taking one side, then re-apply with `pakku add`/`rm`; weekly bot PR is the only automated writer of the lock. |
| #150 | No "export only Modrinth" flag (planned for 2.0). | Target `modrinth` by default, so only `.mrpack` (+ optional serverpack) is produced. |

### Modrinth

- New projects are manually reviewed (can take days). Until approved, the
  GitHub Release `.mrpack` is the documented fallback; Prism and Modrinth App
  can import it.
- `.mrpack` `files` may only download from allowed hosts (Modrinth CDN,
  GitHub, etc.). Non-Modrinth jars go into `overrides` and need a license or
  permission that allows redistribution.
- ProjectE (needed by the first pack) is **CurseForge-only**, MIT-licensed, no
  GitHub release jars. FTB Quests/Library/Teams are CurseForge-only with no
  declared license — avoid. Odyssey Quests (formerly Heracles, MIT) is the
  Modrinth quest mod for the first pack.

### Server

- The user runs the server on their PC with Docker
  `itzg/minecraft-server` + playit.gg agent; friends connect through the
  playit address. **(user)**
- `itzg/minecraft-server` with `TYPE=MODRINTH` installs a modpack from a
  slug, project URL, version URL, or a **local `.mrpack` path** (must end in
  `.mrpack`), installs the loader, skips client-only files, and supports
  `MODRINTH_EXCLUDE_FILES`, `MODRINTH_OVERRIDES_EXCLUSIONS`,
  `MODRINTH_FORCE_SYNCHRONIZE`.

### License

PanPack is LGPL-3.0. BastionPack keeps **LGPL-3.0** for template code
(workflows, scripts, Taskfile) and credits PanPack in the README. Packs
created from the template choose their own license for their content. **(call)**

### User environment

Windows 11 primary (PowerShell, Git Bash), but the template must work on
Linux and macOS too. Toolchain via **mise**; JS via **pnpm**. **(user)**

## 4. Decided design

### 4.1 Repository layout (target)

The repository root **is** the instance's `minecraft/` folder (as in PanPack).

```
/
├─ AGENTS.md                 # AI agent guide (English); no CLAUDE.md (user)
├─ README.md                 # what it is + 5-minute start
├─ CHANGELOG.md              # Keep a Changelog, with ## [Unreleased]
├─ CONTRIBUTING.md           # for pack contributors
├─ LICENSE.md                # LGPL-3.0
├─ Taskfile.yml              # single entry point
├─ mise.toml                 # java 21, node LTS, pnpm, task
├─ package.json              # pnpm; oxlint, oxfmt, typescript
├─ .oxlintrc.json / .oxfmtrc.json
├─ pakku.json / pakku-lock.json
├─ .pakku/
│  ├─ prism-overrides/       # instance.cfg, mmc-pack.json (1.21.1 NeoForge)
│  ├─ overrides/ client-overrides/ server-overrides/   # only if needed
├─ config/ defaultconfigs/   # mod configs (pack content)
├─ kubejs/                   # scripts; probe output gitignored
├─ scripts/                  # Node/TypeScript helpers used by tasks
├─ server/
│  ├─ compose.yaml           # itzg + playit
│  ├─ .env.example
├─ docs/                     # see 4.9
└─ .github/
   ├─ workflows/ ci.yml release.yml mod-updates.yml
   ├─ dependabot.yml
   ├─ ISSUE_TEMPLATE/ PULL_REQUEST_TEMPLATE.md
```

Removed from PanPack: `kubejs/dx/eslint-plugin/*`, `kubejs/eslint.config.mjs`,
`kubejs/package*.json`, `.github/hooks/pre-commit`, `lint.yml`, Forge server
files in `.pakku/server-overrides/` (`minecraft_server.jar`,
`forge-auto-install.txt`, `server_starter.conf`, `start_server.bat`, …),
FTB `defaultconfigs` that don't apply to the base modset, committed
`pakku.jar`.

### 4.2 Pakku configuration

- `pakku-lock.json`: `target: "modrinth"`, `mc_versions: ["1.21.1"]`,
  `loaders: {"neoforge": "<latest stable 21.1.x>"}`.
- `pakku.json`: name/author/description set by `task init`; `version` is
  set at build time via `pakku cfg -v`; overrides: `config`, `defaultconfigs`,
  `kubejs` minus probe output; `export_server_side_projects_to_client: false`.
- Pakku version pinned in one place (a Taskfile var with version + SHA-256),
  downloaded and verified by `task setup` into the repo root (gitignored).
  CI uses the same task. **(call, agreed in conversation)**

### 4.3 Base modset **(user agreed to this set)**

Shipped in the template so a fresh pack boots and passes the server smoke
test. All must exist on Modrinth for 1.21.1 NeoForge (verified in the
availability matrix except where noted).

| Purpose | Mods |
|---|---|
| Performance | Sodium, ModernFix, FerriteCore, ImmediatelyFast, EntityCulling, Noisium |
| Scripting | KubeJS, ProbeJS (`side: CLIENT`, `export: false`) |
| Recipes/info | JEI **(call: JEI over EMI for broadest addon/Create integration)**, Jade |

Optional additions the builder may include if they are low-risk on 1.21.1
NeoForge **(call)**: Crash Assistant (player-friendly crash reports; fits
"easy to troubleshoot"), Spark (profiling). Anything else belongs to the pack,
not the template.

### 4.4 Prism instance and dev loop

- `.pakku/prism-overrides/` holds `instance.cfg` and `mmc-pack.json` for
  1.21.1 NeoForge.
- **Instance location (call, same model as PanPack):** the pack repo is
  cloned into `<Prism instances>/<name>/minecraft`. `task setup:prism`
  first validates that layout (parent dir is a Prism instance dir or an
  empty folder inside Prism's `instances/`); if not, it stops and prints how
  to clone into the right place. No symlinks/junctions. The BastionPack
  template repo itself may be developed outside Prism; Done-criterion 1 is
  verified with a clone inside a Prism instance.
- `task setup:prism` copies them into the parent folder (the Prism instance
  dir), generating `mmc-pack.json` loader/MC versions from the lock.
- Prism `PreLaunchCommand` is a **single cross-platform command** using
  Prism's `$INST_JAVA` (Java may not be on PATH on Windows):
  `"$INST_JAVA" -jar pakku.jar fetch`. **(call)**
- Loader sync is no longer a CI commit: `task prism:sync` rewrites the
  instance `mmc-pack.json` from the lock; `task doctor` detects a mismatch.
  **(call)**
- Daily loop **(user)**: `task mods:add -- <mod>` → Prism Play (prelaunch
  fetches) → test.

### 4.5 Taskfile (public interface)

Names are part of the design; the builder may add internal tasks.

| Task | Does |
|---|---|
| `setup` | Verify tools, download pinned Pakku, `pnpm install`, `pakku fetch`, install git hook. Idempotent. |
| `init` | Turn a fresh template copy into a pack: ask name/author/description/Modrinth slug, write `pakku.json`, Prism instance name, reset `CHANGELOG.md`. |
| `doctor` | Diagnose: tool versions, Pakku version, lock vs `pakku.json` consistency, side cross-check against Modrinth (#131), duplicate override paths (#120), Prism instance loader mismatch. Each finding links a troubleshooting entry. |
| `mods:find -- <query>` | Search Modrinth filtered to the lock's MC version + loader; show slug, title, downloads, last update, client/server side. |
| `mods:add -- <mod...>` / `mods:rm` / `mods:update` | Wrap Pakku and print a `pakku diff` of the change. |
| `check` / `fix` | oxlint + oxfmt check (`fix` applies fixes); `check:types` optional. |
| `build` | Export with a dev version (`0.0.0-dev+<sha>` style, builder decides exact format) into `build/`. |
| `server:up` / `server:down` / `server:logs` / `server:update` | Docker compose against the local build or the published version. |
| `release -- x.y.z` | Validate (clean tree, on `main`, semver, non-empty Unreleased), move Unreleased → `x.y.z` with date, commit, tag, push. |
| `hooks:install` | Pre-commit runs `oxfmt --check` and `oxlint` on staged files. |

Tasks must run identically on Windows/Linux/macOS: any logic beyond a
one-liner lives in `scripts/` as TypeScript run directly by Node's native
type stripping (Node LTS), type-checked by `task check`. **(call)**

### 4.6 JS tooling

- pnpm, `package.json` at repo root. `node_modules` gitignored.
- **oxlint** for correctness on `kubejs/**/*.js` and `scripts/`, with KubeJS
  globals tolerated (PanPack turned `no-undef` off; keep that or declare
  globals). **(user)**
- **oxfmt** for formatting, 4-space indent to match existing scripts.
  Excludes `pakku-lock.json`, `config/`, `defaultconfigs/`, generated probe
  output. **(user)**
- Drop PanPack's custom ESLint rules; ship **one example oxlint JS plugin
  rule** (oxlint `jsPlugins` are ESLint-compatible) documented as "how to
  write your own". **(call)**
- **ProbeJS** generates typings for VS Code autocompletion; `jsconfig.json`
  points at its output. Type-checking KubeJS scripts is opt-in
  (`task check:types`) because generated typings are large and noisy. **(call)**
- CI only verifies; it never pushes fix commits. **(call)**

### 4.7 GitHub workflows

All workflows: pinned action versions, explicit `permissions`, no
`# Change this!`, no owner check hard-coded (forks simply skip publishing
when secrets are absent).

**`ci.yml`** — on push to `main` and on PRs:
1. `task check`.
2. `task build` → upload `.mrpack` as artifact (downloadable dev build).
3. **Server smoke test**: run `itzg/minecraft-server` with `TYPE=MODRINTH`
   and the built `.mrpack`; pass when logs show the server finished
   starting within a timeout; on failure print the tail of the log and the
   crash report if any.
4. Job summary: pack name, version, MC/loader, mod count, diff vs last tag.
   First run without any tag must succeed (no diff, says so).

**`release.yml`** — on tag push `x.y.z`:
1. Same build + smoke test with the real version.
2. Release notes = the `x.y.z` section of `CHANGELOG.md` + `pakku diff`
   against the previous tag's lock.
3. GitHub Release with `.mrpack` (serverpack zip only if enabled).
   Pre-release flag from the version (`-alpha`/`-beta` suffix) **(call)**.
4. Upload to Modrinth if `MODRINTH_TOKEN` secret and `MODRINTH_PROJECT_ID`
   variable exist; otherwise skip with a notice. Builder chooses the
   mechanism (direct Modrinth API v2 call from a script is preferred over a
   third-party action **(call)**).
   **Verification (user):** no staging test. The upload script is also a
   task (`task publish:modrinth`) that reads `MODRINTH_TOKEN` and
   `MODRINTH_PROJECT_ID` from a gitignored `.env` and supports `--dry-run`
   (validates the `.mrpack`, builds the request, prints what would be sent).
   The first real release is published **locally** with this task; once it
   works, CI uses the same script for later releases. The script must refuse
   to upload a version number that already exists on the project.
5. Optional Discord webhook (`DISCORD_WEBHOOK` secret) — skip if absent.
6. CurseForge upload exists but is gated by an explicit variable and the CF
   secrets; off by default. **(user)**

**`mod-updates.yml`** — weekly cron + manual dispatch **(user)**:
1. `pakku update -a`. If the lock is unchanged, stop.
2. Build + server smoke test inside this workflow.
3. Create or update a single PR from `bot/mod-updates` with the `pakku diff`
   and the smoke-test result in the body.
   PRs opened with `GITHUB_TOKEN` don't trigger other workflows, which is why
   the test runs here; if an optional token/App is configured, normal CI runs
   too. **(call)**

**`dependabot.yml`** — GitHub Actions and npm, weekly. **(call: Dependabot over
Renovate, zero setup)**

### 4.8 Local server

`server/compose.yaml`:
- `minecraft`: `itzg/minecraft-server`, `TYPE=MODRINTH`, `EULA=TRUE`,
  memory from `.env`, data in a gitignored folder or named volume.
  Two modes via `.env`: **local** (`MODRINTH_MODPACK=/modpacks/<file>.mrpack`
  bind-mounted from `build/modrinth/`) and **published** (slug + version).
- `playit`: playit.gg agent with `SECRET_KEY` from `.env`. Only the server
  side runs playit; players use the playit address. **(user)**
- `server/.env.example` documents every variable; `.env` is gitignored.
  World and secrets never enter the repo. **(call)**
- `MODRINTH_EXCLUDE_FILES` is documented as a fallback; the preferred fix is
  a `side` override in `pakku.json`.

### 4.9 Documentation (English) **(user)**

Markdown in the repo. Every page: one topic, starts with "Use this when…",
ends with "Verify it worked". Commands shown are `task` commands.

```
README.md                    # what it is, features, 5-minute start, credits (PanPack)
AGENTS.md                    # repo map, commands, rules, how to verify a change
CONTRIBUTING.md
docs/
  getting-started.md         # template → Prism instance → first mod → first release
  concepts.md                # pakku.json vs lock, sides, overrides, targets
  players.md                 # install from Modrinth App/Prism, joining the server, safe optional client mods
  troubleshooting.md         # symptom → cause → fix table; `task doctor` links here
  guides/
    mod-not-on-modrinth.md   # e.g. ProjectE: CF-only, license check, how Pakku embeds it
    wrong-mod-side.md
    lockfile-merge-conflict.md
    server-rejects-connection.md
    quests-odyssey.md
    kubejs-recipes-and-optional-compat.md   # incl. Platform.isLoaded pattern (from CABIN)
    performance-low-end.md
    first-modrinth-release.md               # review wait, GitHub Release fallback
    enable-curseforge.md
    local-server-docker.md                  # itzg + playit
  reference/
    tasks.md
    workflows.md             # what each runs, secrets/variables
    configuration.md         # pakku.json fields used by the template
    pakku.md                 # condensed Pakku CLI/config reference (Pakku isn't in Context7)
```

`AGENTS.md` rules include at least: never edit `pakku-lock.json` by hand;
use `task` commands; run `task check` and `task build` before claiming done;
where docs live; how to look up Pakku (`docs/reference/pakku.md`).

### 4.10 Repository and publishing

- Work continues on branch `bastionpack` in this clone.
- The user gave **explicit permission to create GitHub repos**. Create
  `marr-cloud/BastionPack` (public, marked as template), set `origin` to it
  and keep PanPack as `upstream`. **(user)**
- **Clean history (call):** the new repo starts from a single initial
  commit built from the `bastionpack` branch, pushed as `main`. PanPack's
  commits and tags (`1.3.0`–`1.3.3`) are **not** pushed — they are
  CurseForge/1.20.1/Forge locks that would break "diff vs last tag" and
  semver ordering. Credit to PanPack lives in README and LICENSE. Locally,
  PanPack history stays reachable via the `upstream` remote.
- `docs/superpowers/` (this spec and plans) lives in the BastionPack repo
  for development history; `task init` deletes it in packs created from the
  template. **(call)**
- Issue templates: bug report asks for pack version, launcher, server or
  client, and a log link (mclo.gs). PR template kept short.

## 5. Verification spikes the builder must run early

These are facts we couldn't confirm from docs; results may change details.

1. **CurseForge-only mod in a `modrinth`-target pack**: can `pakku add prj --cf
   projecte` work with `target: modrinth`, and does export embed it as an
   override? If not, does `multiplatform` work without CF/MR mismatch noise?
   The outcome writes `guides/mod-not-on-modrinth.md`. (Needed by
   Engineer's Tea; the template itself ships no CF mods.)
2. **itzg + local `.mrpack` with overrides**: confirm overrides and
   `server-overrides` are honored and client-only mods are skipped.
3. **Smoke-test signal**: the exact log line / health check that means "ready"
   for NeoForge 1.21.1 under itzg (itzg's healthcheck may suffice).
4. **playit agent in compose on Docker Desktop for Windows**: networking
   mode and how the tunnel targets the `minecraft` service.
5. **ProbeJS on 1.21.1**: output location and `jsconfig.json` wiring.
6. **Prism `$INST_JAVA`** in `PreLaunchCommand` works on Windows without a
   shell wrapper.

**Manual checkpoints (call):** spikes 4 and 6 and Done-criteria 1 and 3
need the user's machine (Prism GUI, Docker Desktop, the user's existing
playit agent secret). The plan schedules them as explicit user checkpoints:
spike 6 before `setup:prism` is finalized, spike 4 before `server/compose.yaml`
is finalized. Everything else is verified by the builder (CLI, CI).

## 6. Left to the builder

- Exact dev version string, task internals, script structure, log formatting.
- Exact oxlint rule set and oxfmt options beyond 4-space indent.
- Whether `doctor` side checks call Modrinth on every run or cache.
- Wording and depth of each doc page (keep them short).
- NeoForge loader patch version and exact mod versions.

## 7. Done means

1. Fresh clone on Windows: `mise install` → `task setup` → `task setup:prism`
   → Prism launches the base modset to the main menu.
2. `task check` passes; `task build` produces a `.mrpack`.
3. `task server:up` (local mode) boots the server from that `.mrpack`.
4. `ci.yml` is green on the new repo, including the smoke test, on the very
   first run with no tags.
5. `task release -- 0.1.0` produces a GitHub Release with the `.mrpack` and
   notes; Modrinth upload is skipped with a notice when no token is set.
   `task publish:modrinth --dry-run` passes locally; the real first upload
   is done locally by the user (manual checkpoint).
6. `mod-updates.yml` manual dispatch opens (or correctly skips) the PR.
7. Every task and doc page listed above exists; `AGENTS.md` is accurate.

## 8. Next project

"Engineer's Tea" (first pack, created from BastionPack after it works):
relaxed Create pack for friends who are all systems engineers — automation,
Odyssey Quests (simple quests using Create/ProjectE addons), ProjectE,
farming + compat, QoL, a couple of structure mods and a dungeon-heavy mod
("bastions, not only in the Nether"). Designed separately.
