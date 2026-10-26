# Pakku reference

Use this when you need a Pakku command or config fact. Pakku is not indexed in Context7; the full docs are at https://juraj-hrivnak.github.io/Pakku/ (source: `docs/topics/` in the Pakku repository). This page condenses what BastionPack uses. Pinned version: 1.5.0 (see `Taskfile.yml`).

Prefer the `task` wrappers (`task mods:add` etc.). Call Pakku directly with `java -jar pakku.jar <command>` from the repo root. `-y` is a global flag and goes before the subcommand.

## Commands used

| Command                              | Use                                                                                                         |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `fetch`                              | Download the mods listed in the lock into `mods/`. Prism runs it before launch.                             |
| `add <slug...>`                      | Add mods (and their dependencies). `add prj --cf <slug>` adds a CurseForge project (needs an API key).      |
| `rm <slug...>`                       | Remove mods.                                                                                                |
| `update -a`                          | Update all mods.                                                                                            |
| `export`                             | Write `build/modrinth/*.mrpack` (and `build/curseforge/*.zip` for multiplatform, `build/serverpack/*.zip`). |
| `diff`                               | Compare two lock files; `--markdown` for changelog text.                                                    |
| `cfg -v <version>`                   | Set the pack version.                                                                                       |
| `cfg prj -s BOTH <slug>`             | Set a project's side (flag before the slug). Writes `pakku.json`.                                           |
| `cfg prj -r <slug>`                  | Mark a project redistributable.                                                                             |
| `set -t <target>`                    | Set target: `modrinth`, `curseforge` or `multiplatform`.                                                    |
| `credentials set --cf-api-key <key>` | Store a CurseForge API key (only for CurseForge access).                                                    |
| `status`, `insp`                     | Inspect state and projects.                                                                                 |

`GITHUB_ACCESS_TOKEN` in the environment raises GitHub API rate limits.

## pakku.json project properties

`type`, `side` (`CLIENT|SERVER|BOTH`), `update_strategy` (`LATEST|FLEXVER|NONE`), `redistributable`, `subpath`, `aliases`, `export`. Top level: `name`, `version`, `overrides`, `client_overrides`, `server_overrides`, `export_server_side_projects_to_client` (default false).

## Behaviors that matter

- In multiplatform packs, a project missing on the current platform is included as an override if redistributable, otherwise dropped.
- Side detection comes from Modrinth metadata and can be wrong (issue #131).

## Known issues and mitigations

| Issue | Problem                                                                              | What the template does                                                     |
| ----- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| #131  | Modrinth side detection wrong (Create becomes `SERVER`).                             | `task doctor` cross-checks sides and prints the fix.                       |
| #141  | `!` exclusions in side override lists do not apply to paths included by `overrides`. | List side-specific folders fully per side.                                 |
| #120  | Same path in `overrides` and `.pakku/server-overrides/` picks an arbitrary winner.   | `task doctor` warns.                                                       |
| #142  | No regeneration for lock merge conflicts.                                            | [lockfile-merge-conflict](../guides/lockfile-merge-conflict.md).           |
| #150  | No "export only Modrinth" flag.                                                      | Target `modrinth`, so only the `.mrpack` and optional server zip are made. |

## Verify it worked

`task doctor` confirms `pakku.jar` matches the pinned 1.5.0 checksum, and `task setup` prints `pakku 1.5.0: present` (or `downloaded` the first time).
