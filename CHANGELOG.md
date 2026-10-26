# Changelog

All notable changes to this modpack are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.3.0] - 2026-10-26

### Added

- Guide for switching the recipe viewer to EMI (keeping JEI so mods' JEI plugins still show).
- Performance guide: optional ModernFix and ImmediatelyFast tweaks, garbage collector advice, and per-pack mods (More Culling, C2ME, Iris, LambDynamicLights).

### Changed

- Lithium replaces Noisium in the base modset: Noisium is rated a negligible improvement by the MC Optimization Guide and is no longer updated.
- Refreshed BastionPack icon (one row shorter, better centered).

## [0.2.1] - 2026-10-23

### Added

- Local server: optional `AUTH_SERVER` in `server/.env` (for example `ely.by`) runs the server with a pinned authlib-injector so Ely.by and other Yggdrasil accounts can join.

## [0.2.0] - 2026-10-23

### Added

- BastionPack icon (original pixel art): README logo and default `kubejs/config/packicon.png`, with its Aseprite source in `docs/assets/`.
- Crash Assistant ships configured for the pack: `task init` asks for creator nicknames and a help link, and `task doctor` warns while they are still `CHANGE_ME`.

### Changed

- Guide `mod-not-on-modrinth`: new verified path for mods published as GitHub Releases (for example a fork of ProjectE).
- Tooling runtime moved to Node 26. Dev builds are now versioned `<tag>+dev.<sha>`.

### Fixed

- The local server keeps `/data` in a named Docker volume instead of a bind mount; on Docker Desktop for Windows the bind mount made the NeoForge install take many minutes. The server guide covers backups.
- Scripts no longer silently do nothing when the repo is reached through a symlink or junction.
- `task setup` now installs npm dependencies; `task release` rejects extra arguments; stalled Pakku downloads time out.
- `task server:up` always recreates the container and resyncs the local pack.
- `task setup:prism` writes `instance.cfg` values escaped the way Prism (Qt) reads them; the pre-launch `pakku fetch` command was being run with its arguments glued together.
- `task build` runs `pakku fetch` before exporting, so GitHub-hosted mods are no longer silently left out of the `.mrpack`.
- First-launch files are gitignored: KubeJS's `web_server.json` (holds an auth token), ProbeJS's generated agents and `package.json`, `command_history.txt` and per-player Sodium settings. The template ships `kubejs/startup_scripts/` and `kubejs/client_scripts/` placeholders and KubeJS's default `common.json`/`client.json`, so the first launch no longer generates example scripts.
- Removed PanPack's pack icon (`kubejs/config/packicon.png`).

## [0.1.0] - 2026-10-23

### Added

- BastionPack icon (original pixel art): README logo and default `kubejs/config/packicon.png`, with its Aseprite source in `docs/assets/`.

- First release of the BastionPack template: Minecraft 1.21.1 NeoForge base pack with performance mods, KubeJS + ProbeJS, JEI, Jade, Crash Assistant and spark.
