# Configuration

Use this when you need to know which `pakku.json` fields and files the template uses and where each kind of file goes.

## pakku.json

| Field                                   | Meaning                                                                                                                    |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `name`                                  | Pack name. `task init` sets it; `BastionPack` means "not initialized".                                                     |
| `version`                               | Keep `0.0.0-dev`. The build sets the real version temporarily.                                                             |
| `overrides`                             | Folders copied into the pack: `config`, `defaultconfigs`, `kubejs`, with `!kubejs/probe/**` excluded.                      |
| `projects.<slug>.side`                  | `CLIENT`, `SERVER` or `BOTH`. Explicit values win over what Pakku detects ([wrong-mod-side](../guides/wrong-mod-side.md)). |
| `projects.<slug>.export`                | `false` keeps a mod in your dev instance but out of the exported pack (ProbeJS uses this).                                 |
| `export_server_side_projects_to_client` | Defaults to `false`; Pakku omits default values from the file, so you will not see it.                                     |

`task doctor` warns about `projects` entries that match no mod in the lock.

## Override folders

| Path                                    | Goes to                                             |
| --------------------------------------- | --------------------------------------------------- |
| `config/`, `defaultconfigs/`, `kubejs/` | everyone (listed in `overrides`)                    |
| `.pakku/overrides/`                     | everyone                                            |
| `.pakku/client-overrides/`              | client only                                         |
| `.pakku/server-overrides/`              | server only                                         |
| `.pakku/prism-overrides/`               | not exported; template for the Prism instance files |

Do not place the same path in two of these (Pakku issue #120).

Pakku issue #141: `!` exclusions in `client_overrides`/`server_overrides` do not apply to paths already included by `overrides`. If you need side-specific KubeJS folders, list each side's folders fully in its own override list instead of excluding.

## Crash Assistant

`config/crash_assistant/config.toml` is shipped with the pack. `task init` sets `modpack_name`, `modpack_creators` and `help_link` (and `formulation_type` for GitHub links). Keep `modpack_creators` non-empty: an empty list makes every player a creator. Commit `config/crash_assistant/modlist.json` after the creator's first launch.

## Other files

| File           | Purpose                                                                          |
| -------------- | -------------------------------------------------------------------------------- |
| `Taskfile.yml` | Task definitions and the pinned `PAKKU_*` and `AUTHLIB_*` versions and hashes.   |
| `mise.toml`    | Pinned Java 21, Node 26, pnpm, Task.                                             |
| `server/.env`  | Local server settings (gitignored, copy of `server/.env.example`).               |
| `.env`         | Local publish credentials (gitignored): `MODRINTH_TOKEN`, `MODRINTH_PROJECT_ID`. |
| `CHANGELOG.md` | Keep a Changelog format; releases promote `## [Unreleased]`.                     |

## Verify it worked

`task doctor` reports no stale or duplicate entries, and `task build` produces a pack with the intended sides.
