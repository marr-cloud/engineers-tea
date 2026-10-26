# Workflows

Use this when you need to know what each GitHub Actions workflow runs and which secrets and variables it reads. Nothing needs editing in the workflow files: everything is derived from `pakku.json`, the repository, or the settings below.

## ci.yml

Runs on pushes to `main` and on pull requests. Steps: `task check`, `task test`, `task build`, upload the `.mrpack` as an artifact, the server smoke test (real `itzg/minecraft-server` boot) and a job summary (pack, version, mod count, diff against the last tag; works with no tag). CI only verifies and never pushes commits.

## release.yml

Runs on a tag like `1.2.0` (created by `task release`). Builds with the real version, runs the smoke test, creates a GitHub Release with the `.mrpack` and notes (the changelog section plus the mod diff; `-alpha`/`-beta` versions are pre-releases), then optionally publishes.

## mod-updates.yml

Weekly (Monday) and on manual dispatch. Runs `pakku update`, stops if the lock is unchanged, otherwise builds, smoke-tests and opens or updates one PR from `bot/mod-updates` with the diff and the smoke result. Nothing is auto-merged.

PRs opened with `GITHUB_TOKEN` do not trigger other workflows, which is why the test runs inside this workflow. Setting `BOT_TOKEN` makes normal CI run on the PR too.

## Secrets and variables

Set in the repo under Settings, Secrets and variables, Actions.

| Name                  | Kind             | Needed for                                       |
| --------------------- | ---------------- | ------------------------------------------------ |
| `MODRINTH_TOKEN`      | secret           | Modrinth upload. Missing: skipped with a notice. |
| `MODRINTH_PROJECT_ID` | variable         | Modrinth upload (the project id, not the slug).  |
| `DISCORD_WEBHOOK`     | secret, optional | Release announcement. Missing: skipped.          |
| `BOT_TOKEN`           | secret, optional | Lets the update PR trigger CI.                   |
| `BUILD_SERVERPACK`    | variable         | `true` also builds the server zip.               |
| `ENABLE_CURSEFORGE`   | variable         | `true` enables the CurseForge upload.            |
| `CURSEFORGE_TOKEN`    | secret           | CurseForge upload.                               |
| `CURSEFORGE_ID`       | variable         | CurseForge project id.                           |

Repository setting **Allow GitHub Actions to create and approve pull requests** (Settings, Actions, General) must be on for the weekly update PR to be created with `GITHUB_TOKEN`.

Missing optional secrets never fail a build. See [first-modrinth-release](../guides/first-modrinth-release.md) and [enable-curseforge](../guides/enable-curseforge.md).

## Verify it worked

The Actions tab shows CI green on a PR, and a release run lists the Modrinth step as uploaded or "skipped" with the reason.
