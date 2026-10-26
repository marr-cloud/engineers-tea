# AGENTS.md

Guide for AI coding agents (and humans) working in this repository. BastionPack is a Modrinth-first Minecraft 1.21.1 NeoForge modpack template. Promise: reliable, robust, easy to troubleshoot.

## Repo map

| Path                         | What                                                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `pakku.json`                 | Hand-edited pack config (name, overrides, per-mod `side`).                                                                  |
| `pakku-lock.json`            | Generated mod list. **Never edit by hand.**                                                                                 |
| `Taskfile.yml`               | The single entry point; also pins Pakku (`PAKKU_VERSION`, `PAKKU_SHA256`).                                                  |
| `scripts/`                   | Node 26 TypeScript (run natively, erasable syntax, `.ts` imports) behind the tasks. Tests are `*.test.ts` next to the code. |
| `kubejs/`                    | KubeJS scripts (JavaScript only).                                                                                           |
| `config/`, `defaultconfigs/` | Mod configs shipped as overrides.                                                                                           |
| `.pakku/`                    | Pakku overrides (`overrides/`, `client-overrides/`, `server-overrides/`) and `prism-overrides/` (not exported).             |
| `server/`                    | `compose.yaml` (itzg + playit) and `.env.example`.                                                                          |
| `oxlint-plugin/`             | Example custom lint rule.                                                                                                   |
| `docs/`                      | All documentation (see below).                                                                                              |
| `.github/workflows/`         | `ci.yml`, `release.yml`, `mod-updates.yml`.                                                                                 |

## Tasks

Run `task --list` for the live list. Details: `docs/reference/tasks.md`.

`setup`, `init`, `doctor`, `build`, `check`, `fix`, `test`, `check:types`, `check:staged`, `hooks:install`, `setup:prism`, `prism:sync`, `mods:find`, `mods:add`, `mods:rm`, `mods:update`, `release`, `publish:modrinth`, `server:up`, `server:down`, `server:logs`, `server:update`, `server:smoke`.

## Rules

1. Never edit `pakku-lock.json` by hand. Use `task mods:add`, `task mods:rm`, `task mods:update`.
2. Use `task` commands, not raw `java -jar pakku.jar`, unless a doc says otherwise. Spawn processes from scripts through `run()` in `scripts/lib/exec.ts`.
3. Before claiming a change is done, run `task check`, `task test` and `task build`, and read the output. `task fix` applies formatting (oxfmt formats Markdown too).
4. After adding or changing a mod, run `task doctor` and fix any side mismatch in `pakku.json` (`docs/guides/wrong-mod-side.md`).
5. Errors are `BastionError` with a message, a `hint` and a `docs` link to `docs/troubleshooting.md#<anchor>`. When you add an error, add a heading to `troubleshooting.md` whose text slugs to that anchor. `task check` fails otherwise.
6. Never write secrets (Modrinth, CurseForge, playit, Discord tokens) into files or commands. They come from `.env`, `server/.env` or GitHub secrets.
7. KubeJS is JavaScript (Rhino), not TypeScript. Guard optional mods with `Platform.isLoaded('modid')`.
8. Docs are English, short, task-oriented. Each guide starts with "Use this when" and ends with "Verify it worked". Mention only `task` names that exist.
9. Do not hand-edit `CHANGELOG.md` sections for released versions. Add entries under `## [Unreleased]`; `task release -- x.y.z` promotes them.
10. Do not push to `main` directly or cut releases without being asked.

## Docs

- `README.md`: what it is, 5-minute start, credits.
- `docs/getting-started.md`, `docs/concepts.md`, `docs/players.md`
- `docs/troubleshooting.md`: symptom, cause, fix; every script error links here.
- `docs/guides/`: one task per page (wrong mod side, CF-only mods, server, releases, KubeJS, performance, EMI).
- `docs/reference/`: `tasks.md`, `workflows.md`, `configuration.md`, `pakku.md`.
- **Pakku is not in Context7.** Use `docs/reference/pakku.md` (condensed) or https://juraj-hrivnak.github.io/Pakku/.
- `docs/superpowers/` holds design history and is removed by `task init` in packs.

## Verify it worked

`task check` and `task test` pass, `task build` writes `build/modrinth/*.mrpack`, and `task doctor` shows no errors.
