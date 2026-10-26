# Task reference

Use this when you need the exact name or arguments of a command. `task --list` is the live source; this page groups the same tasks. Arguments after `--` go to the script.

## Setup

| Task                 | Does                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `task setup`         | Install npm dependencies, download the pinned Pakku (checksum verified), fetch mods, enable git hooks. Idempotent.                         |
| `task init`          | Turn the template into your pack. Flags: `--name N --author A --description D --modrinth-slug S --creators NICKS --help-link URL --force`. |
| `task doctor`        | Diagnose tools, `pakku.jar`, Prism sync, mod sides, duplicate overrides. Each finding links to the docs.                                   |
| `task hooks:install` | Enable the repo git hooks (`.githooks`).                                                                                                   |
| `task setup:prism`   | Write `instance.cfg` and `mmc-pack.json` for the Prism instance. Close Prism first.                                                        |
| `task prism:sync`    | Rewrite only `mmc-pack.json` from `pakku-lock.json` after a Minecraft or NeoForge bump.                                                    |

## Mods

| Task                         | Does                                               |
| ---------------------------- | -------------------------------------------------- |
| `task mods:find -- <query>`  | Search Modrinth for mods compatible with the pack. |
| `task mods:add -- <slug...>` | Add mods through Pakku and print the lock diff.    |
| `task mods:rm -- <slug...>`  | Remove mods and print the lock diff.               |
| `task mods:update`           | Update all mods, or only `-- <slug...>`.           |

## Quality

| Task                | Does                                                                 |
| ------------------- | -------------------------------------------------------------------- |
| `task check`        | oxfmt check, oxlint, tsc, and the docs check.                        |
| `task fix`          | Apply oxfmt and oxlint fixes.                                        |
| `task test`         | Run script and lint-plugin tests.                                    |
| `task check:types`  | Type-check KubeJS against ProbeJS typings (opt-in, needs `.probe/`). |
| `task check:staged` | What the pre-commit hook runs (the full `check`).                    |

## Build and release

| Task                           | Does                                                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `task build`                   | Build the `.mrpack` into `build/` (dev version; `VERSION=x.y.z`; `SERVERPACK=true` adds the server zip). |
| `task release -- x.y.z`        | Validate, promote the changelog, commit, tag and push.                                                   |
| `task publish:modrinth -- ...` | Upload the built `.mrpack`. Flags: `--dry-run`, `--skip-existing`, `--version x.y.z`. Reads `.env`.      |

## Local server

| Task                 | Does                                                                                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `task server:up`     | Build the dev pack and start server + playit (`SERVER_USE_ENV_PACK=true` skips the build; `AUTH_SERVER` in `server/.env` enables Ely.by and other auth servers). |
| `task server:down`   | Stop them.                                                                                                                                                       |
| `task server:logs`   | Follow the logs.                                                                                                                                                 |
| `task server:update` | Pull images and force a modpack resync.                                                                                                                          |
| `task server:smoke`  | Boot a throwaway server from the built `.mrpack` and wait for the ready line.                                                                                    |

## Verify it worked

`task --list` shows every task above; `task check` fails if this documentation mentions a task that does not exist.
