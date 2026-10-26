# Contributing

Use this when you want to change the pack (add a mod, tweak a recipe, fix a config) and send it for review.

## Set up

Follow [docs/getting-started.md](docs/getting-started.md): clone into a Prism instance folder, `mise install`, `task setup`, `task setup:prism`.

## Make a change

1. Branch from `main`.
2. Change the pack:
    - Mods: `task mods:find -- <query>`, `task mods:add -- <slug>`, `task mods:rm -- <slug>`. Never edit `pakku-lock.json` by hand.
    - Recipes: KubeJS in `kubejs/` ([guide](docs/guides/kubejs-recipes-and-optional-compat.md)).
    - Configs: change them in game, then commit the changed files in `config/`.
3. Launch in Prism and test. Run `task doctor` after adding mods.
4. Add a line under `## [Unreleased]` in `CHANGELOG.md`.
5. Run `task check`, `task test` and `task build` (`task fix` repairs formatting).
6. Open a pull request. CI repeats these checks and boots a real server with the built pack.

Keep each PR to one topic. Do not include unrelated config churn. If a config file changes on every launch, tell the maintainers instead of committing it.

## Lock conflicts

See [lockfile-merge-conflict](docs/guides/lockfile-merge-conflict.md).

## Reporting bugs

Use the bug report template. Include the pack version, launcher, client or server, and a log link from https://mclo.gs. Try the pack without extra mods first.

## Verify it worked

Your PR shows green checks and the changelog line describes your change.
