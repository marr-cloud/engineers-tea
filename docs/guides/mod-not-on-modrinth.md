# Mod not on Modrinth

Use this when a mod you want is not on Modrinth (example: ProjectE, MIT-licensed, CurseForge only) and your pack publishes to Modrinth.

The template ships `target: "modrinth"` and no CurseForge mods. Path A is verified with ProjectE; paths B and C are **unverified**.

## First: check alternatives and the license

- `task mods:find -- <name>` for a Modrinth equivalent.
- Modrinth only allows downloads from `cdn.modrinth.com`, `github.com`, `raw.githubusercontent.com` and `gitlab.com` in the `.mrpack` index. Anything else must ship inside the pack as an override.
- Either way you are redistributing someone else's mod: its license must allow it (MIT, Apache-2.0, LGPL and similar do), or you need the author's written permission. Keep a link to the license for Modrinth moderation.
- Mods without a declared license (for example the FTB mods) must not be redistributed. Avoid them on Modrinth.

## Path A: GitHub Releases from a fork (recommended)

Pakku resolves mods from GitHub Releases, and the `.mrpack` then downloads the jar from `github.com` with full hashes. If the upstream repo already publishes release jars for your Minecraft version and loader, skip to step 3 and use the upstream repo.

1. Fork the mod's repository and add a workflow that builds the jar and publishes **one jar per release** (Pakku takes every release asset as a file of the project). Working example: [marr-cloud/ProjectE](https://github.com/marr-cloud/ProjectE), `.github/workflows/release.yml` and `FORK.md`. It builds a chosen ref with Gradle and tags the release `mc<minecraft>-<version>-<sha7>`, adding `-beta` when requested (Pakku reads the release type from the tag name).
2. Run the workflow: `gh workflow run release.yml -R <you>/<mod> -f ref=<branch-or-commit>`.
3. Add it to the pack (Pakku asks for confirmation):

    ```sh
    task mods:add -- prj --gh <you>/<mod>
    ```

    Pin a release with `--gh <you>/<mod>@<tag>`. Without a pin, `task mods:update` (and the weekly update PR) moves to the newest release, so publish only builds for this pack's Minecraft version and loader in that repo.

4. Set the side if it is not `BOTH` (`docs/guides/wrong-mod-side.md`). `task doctor` cannot cross-check GitHub projects against Modrinth.

`task build` runs `pakku fetch` before exporting. Pakku needs the downloaded jar to compute the SHA-1 and SHA-512 the `.mrpack` requires, and without it the mod is silently left out ([Pakku #157](https://github.com/juraj-hrivnak/Pakku/issues/157)).

## Path B: multiplatform target (UNVERIFIED)

Needs a CurseForge API key from https://console.curseforge.com/ (API keys tab).

```sh
java -jar pakku.jar credentials set --cf-api-key <key>
java -jar pakku.jar set -t multiplatform
java -jar pakku.jar add prj --cf projecte
```

Keep the key out of the repo and out of shell history where you can. Per the Pakku docs, a project not on the current platform is included as an override if it is marked redistributable (`pakku cfg prj -r`), otherwise dropped. Expect cross-platform mismatch warnings. After `task build`, check that the jar is under `overrides/mods/` in `build/modrinth/*.mrpack`. A multiplatform target also exports a CurseForge zip.

## Path C: manual jar (UNVERIFIED)

For permissively licensed mods (such as MIT): download the jar for Minecraft 1.21.1 + NeoForge and put it in `.pakku/overrides/mods/`. No API key needed; updates are manual and the jar is committed to git. Make sure the license allows redistribution and keep it noted in `CHANGELOG.md`.

## Verify it worked

Unzip the built `.mrpack`. With path A the jar is listed in `modrinth.index.json` with a `github.com` download URL; with B or C it is under `overrides/mods/`. Then `task server:smoke` passes and the mod loads in Prism.
