# First Modrinth release

Use this when you are publishing a new pack to Modrinth for the first time.

New Modrinth projects are reviewed manually, which can take days. Until approved, the GitHub Release `.mrpack` is the fallback: Prism and the Modrinth App can import it.

## One-time setup

1. Create the project on Modrinth (type: modpack) and submit it for review. Note the project **id** (project menu, Copy ID), not the slug.
2. Create a personal access token with version-create scope: https://modrinth.com/settings/pats.
3. Create a `.env` in the repo root (gitignored; never commit it):

    ```sh
    MODRINTH_TOKEN=...
    MODRINTH_PROJECT_ID=...
    ```

## Release 0.1.0, then upload it locally

Do the first release in this order, so 0.1.0 gets a tag, a GitHub Release and a changelog section, and the first Modrinth upload is one you watch:

1. Tag the release: `task release -- 0.1.0` (from `main`, clean tree, non-empty `## [Unreleased]`). CI builds and creates the GitHub Release. It skips Modrinth because the secrets do not exist yet.
2. Upload by hand so you can see it work:

    ```sh
    task build VERSION=0.1.0
    task publish:modrinth -- --version 0.1.0 --dry-run
    task publish:modrinth -- --version 0.1.0
    ```

    `--dry-run` validates the `.mrpack` and prints what would be sent. The command refuses a version that already exists on the project.

## Then automate

1. Repo settings, Secrets and variables, Actions: add secret `MODRINTH_TOKEN` and variable `MODRINTH_PROJECT_ID`.
2. From 0.2.0 on, `task release -- 0.2.0` is enough. The tag runs the release workflow: build, server smoke test, GitHub Release, Modrinth upload with `--skip-existing`. See [workflows](../reference/workflows.md).

If the upload step fails, the GitHub Release still exists; re-run the job, or see [troubleshooting](../troubleshooting.md#publish-failed).

## Verify it worked

The version appears under the project's Versions on Modrinth (listed once the project is approved), and importing it in Prism gives a launchable instance.
