# Concepts

Use this when you need to understand how the pack's files relate before changing them.

## Source of truth

- `pakku.json` is **your** configuration: pack name, version, override folders, per-mod settings. Edit it by hand.
- `pakku-lock.json` is **generated** by Pakku: the exact mods, versions, loader and Minecraft version. Never edit it by hand; use `task mods:add`, `task mods:rm`, `task mods:update`.
- The client `.mrpack` and the server are both built from the same lock, so their mod lists cannot diverge.

## Target

`pakku-lock.json` has a `target`: `modrinth` (default here), `curseforge` or `multiplatform`. With `modrinth`, `task build` produces a `.mrpack`. CurseForge is off by default; see [enable-curseforge](guides/enable-curseforge.md).

## Sides

Each mod has a `side`: `CLIENT`, `SERVER` or `BOTH`. Sides decide where a mod is installed: client-only mods are skipped on the server, server-only mods are not in the client pack. Pakku reads sides from Modrinth metadata, and that is sometimes wrong (Pakku issue #131: Create is read as `SERVER`). `task doctor` catches this. An explicit override on a mod that Modrinth tags as both-sides is intentional and not flagged. Fix: [wrong-mod-side](guides/wrong-mod-side.md).

## Overrides

Overrides are files copied into the instance as-is:

- `config/`, `defaultconfigs/`, `kubejs/` go to everyone (listed in `overrides` in `pakku.json`).
- `.pakku/overrides/` also goes to everyone, `.pakku/client-overrides/` and `.pakku/server-overrides/` to one side only.
- Never put the same path in two places (Pakku issue #120). `task doctor` warns about it.
- `.pakku/prism-overrides/` is not exported: it is the template for the Prism instance files.

## Versions

`pakku.json` keeps `"version": "0.0.0-dev"`. The real version is applied at build time (`task build VERSION=x.y.z`; releases do it for you) and is never committed.

## Pakku binary

Pakku is pinned in `Taskfile.yml` (`PAKKU_VERSION` and `PAKKU_SHA256`). `task setup` downloads `pakku.jar` (gitignored). CI uses the same task, so local and CI builds match. See [reference/pakku](reference/pakku.md).

## Verify it worked

`task doctor` is green, and you can say for any file whether it is hand-edited (`pakku.json`, configs, KubeJS) or generated (`pakku-lock.json`, `build/`).
