# Changelog

All notable changes to this modpack are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Core: Create, Farmer's Delight, Create: Central Kitchen, Create: Enchantment Industry, More Delight, ProjectE (marr-cloud/ProjectE build) with ProjectE Integration, Odyssey Quests, Lootr.
- Bosses: Mowzie's Mobs, Bosses of Mass Destruction, L_Ender's Cataclysm.
- Structures: YUNG's Better Dungeons, Mineshafts, Strongholds, Desert Temples, Jungle Temples and Nether Fortresses, Explorify, Dungeons and Taverns, Explorer's Compass.
- Gear and quality of life: Sodium Extra (FPS counter, low-end toggles) and Reese's Sodium Options, Artifacts, GraveStone, Waystones, Xaero's Minimap and World Map, Sophisticated Backpacks, AppleSkin, Chunky and DimWorldBorder (server only).
- `task check` validates that lang files, item textures and quest translation keys stay consistent.

### Fixed

- Server-only mods are included in the `.mrpack` (from BastionPack: `task build` no longer passes `--no-server`).
- Boss keys (Wrought Core, Glacial Heart, Gauntlet Core, Infernal Ember): every player near a chapter boss gets one when it dies; they show their source and unlock in the tooltip, in English and Spanish.
- ProjectE on a leash: Dark Matter needs the Wrought Core; EMC collectors, relays and the Harvest Goddess Band need the Glacial Heart; Red Matter, Swiftwolf's Rending Gale (flight) and the Watch of Flowing Time need the Gauntlet Core. Create intermediates (andesite alloy, brass, sheets, mechanisms) have no EMC.
- Quests for chapter 1 "Kettle On" (11) and chapter 2 "Brass & Steam" (10), ending with the Ferrous Wroughtnaut and its Wrought Core. Titles are translated; descriptions are in English and Spanish.
- Guides: pregenerating the world with Chunky (`docs/guides/pregenerate-world.md`) and player setup with Ely.by and memory settings.
- The local server's Docker project is `engineers-tea` (from BastionPack: `task init` no longer leaves it as `bastionpack`).
- Pack icon: a glass jug of amber tea with a brass gear and a mint leaf (original pixel art, Aseprite source in `docs/assets/`).
