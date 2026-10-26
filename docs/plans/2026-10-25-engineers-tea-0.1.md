# Engineer's Tea 0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Engineer's Tea 0.1 before the first group session (~2026-11-25): the full world-affecting mod list, all four boss keys, ProjectE gates, chapters 1–2 with quests, pregeneration, and a release on Modrinth.

**Architecture:** A pack repo created from the BastionPack template and cloned into an ElyPrism instance. Mods via Pakku tasks; behavior via KubeJS (startup: items; server: recipes and boss drops; client: tooltips) and assets under the `engineers_tea` namespace; ProjectE balance via `config/ProjectE/custom_emc.json`; quests as Odyssey Quests (Heracles) JSON under `config/heracles/`. A Node content check (template style, TypeScript, `node:test`) keeps lang files, textures and quest keys consistent.

**Tech Stack:** Minecraft 1.21.1, NeoForge, Pakku 1.5.0, KubeJS 2101 (Rhino JS), ProjectE fork (marr-cloud/ProjectE), Odyssey Quests 2.0.3, Node 26 + TypeScript, Taskfile, Docker itzg + playit, Aseprite 1.3.17 (`C:\meitrix\aseprite\aseprite.exe`).

**Spec:** `C:\Users\maurr\workspace\minecraft\engineers-tea-design.md` (moves to `docs/design.md` in Task 1). Executors read both.

## Global Constraints

- Minecraft 1.21.1 + NeoForge; 100% Modrinth except ProjectE from `--gh marr-cloud/ProjectE`.
- No Sinytra Connector, Forgified Fabric API or any Fabric-on-NeoForge mod.
- Total mods (including libraries) ≤ 130.
- Client heap 4–5 GB, server heap 3–4 GB (`MEMORY=4G`), both on the host laptop.
- No When Dungeons Arise or other giant-structure mods; Cataclysm stays only if Task 4 passes with it.
- World is never reset: every mod that adds blocks, worldgen, structures or bosses is in 0.1.
- Item namespace `engineers_tea`; every pack-added text has keys in `en_us`, `es_es` and `es_mx` (same keys, Spanglish allowed).
- Crash Assistant creators `meitrix8208` (pack repo only, never the template).
- Template rules apply (repo `AGENTS.md`): mods only via `task mods:add`, `task mods:rm` and `task mods:update`, errors are `BastionError` with a `docs/troubleshooting.md#anchor`, never hand-edit `pakku-lock.json`, never write secrets, `CHANGELOG.md` entries under `[Unreleased]`.
- Pakku prompts are interactive; in non-interactive shells pipe answers: `yes Y | mise exec -- task mods:add -- <slugs>`.
- Shell PATH has Node 24; run every task as `mise exec -- task <name>`. In Git Bash use `MSYS_NO_PATHCONV=1` for container paths.
- `gh` defaults to the upstream of a template clone; always pass `--repo marr-cloud/engineers-tea`.
- Art is original pixel art only (no copied textures), drawn with Aseprite Lua scripts kept in `C:\Users\maurr\workspace\minecraft\engineers-tea-art\`.

## Decisions this plan makes (builder's calls, from the spec's "left to the builder")

| Chapter boss                            | Entity id (verify in Task 5)           | Key item                       | English / Spanish                     | EMC     |
| --------------------------------------- | -------------------------------------- | ------------------------------ | ------------------------------------- | ------- |
| 1 (end of ch. 2) Ferrous Wroughtnaut    | `mowziesmobs:ferrous_wroughtnaut`      | `engineers_tea:wrought_core`   | Wrought Core / Núcleo Forjado         | 32768   |
| 2 (end of ch. 3) Frostmaw               | `mowziesmobs:frostmaw`                 | `engineers_tea:glacial_heart`  | Glacial Heart / Corazón Glacial       | 131072  |
| 3 (end of ch. 4) Nether Gauntlet        | `bosses_of_mass_destruction:gauntlet`  | `engineers_tea:gauntlet_core`  | Gauntlet Core / Núcleo del Guantelete | 524288  |
| 4 (end of ch. 5) Ignis, fallback Wither | `cataclysm:ignis` / `minecraft:wither` | `engineers_tea:infernal_ember` | Infernal Ember / Brasa Infernal       | 2097152 |

- Boss keys are given by a KubeJS `EntityEvents.death` handler (one per player within 64 blocks in the same dimension; dropped at the boss if nobody is in range). LootJS is not needed, which is a deviation from the spec's wording with the same behavior.
- Repo `marr-cloud/engineers-tea`, public. Work happens on branch `feat/v0.1` with a **draft PR** marked "merge when 0.1 is complete" (the user squash-merges fast; a draft prevents an early merge).
- Chapter names: 1 "Kettle On", 2 "Brass & Steam", 3 "Frost & Gears", 4 "Nether Shift", 5 "Last Pour".

## Review Focus

1. A boss dies with no player within 64 blocks (killed by lava, fall or another mob, or players already dead): its key must drop at the boss's position, never vanish (Task 6 test).
2. A player in another dimension or far away when a boss dies gets nothing, and players in range each get exactly one (Task 6 test).
3. A client with locale `es_mx`, `es_es` or `en_us` sees translated names, never raw keys (Task 2 parity check plus Task 8 in-game check).
4. Alternate recipes bypassing a gate (`red_matter_alt`, other mods' recipes for gated items): JEI must show only the gated recipes for each gated item (Task 7 test).
5. Items made from Create intermediates (cogwheels, mechanisms, sheets) must also show no EMC, so Create lines cannot be skipped through derived items (Task 7 test).

---

### Task 1: Create the pack repo inside an ElyPrism instance

**Files:**

- Create (repo): `marr-cloud/engineers-tea` from template `marr-cloud/BastionPack`
- Create: `%APPDATA%\ElyPrismLauncher\instances\Engineer's Tea\minecraft\` (the clone)
- Create: `docs/design.md` (from `C:\Users\maurr\workspace\minecraft\engineers-tea-design.md`), `docs/plans/2026-10-25-engineers-tea-0.1.md` (this file)

**Interfaces:**

- Produces: repo root = instance `minecraft/` folder; branch `feat/v0.1`; draft PR.

- [ ] **Step 1:** `gh repo create marr-cloud/engineers-tea --public --template marr-cloud/BastionPack`, then `git clone` it into `...\instances\Engineer's Tea\minecraft` (create the instance folder first; ElyPrism must be closed).
- [ ] **Step 2:** `mise install`, `mise exec -- task setup`.
- [ ] **Step 3:** `mise exec -- task init -- --name "Engineer's Tea" --author "meitrix8208" --description "A relaxed Create pack: build, brew, explore dungeons and beat bosses with friends." --modrinth-slug engineers-tea --creators meitrix8208` (help link defaults to the repo's issues). Expected: README and CHANGELOG reset, `docs/superpowers/` removed.
- [ ] **Step 4:** `mise exec -- task setup:prism`. Expected: `instance.cfg` and `mmc-pack.json` written next to `minecraft/`.
- [ ] **Step 5:** Copy the spec to `docs/design.md` and this plan to `docs/plans/2026-10-25-engineers-tea-0.1.md`; link both from the pack README.
- [ ] **Step 6:** Verify: `mise exec -- task check`, `mise exec -- task test`, `mise exec -- task build`, `mise exec -- task doctor` (no Crash Assistant warnings now).
- [ ] **Step 7:** Create branch `feat/v0.1` (right after cloning, before Step 2, so nothing is committed to `main`), commit `chore: initialize Engineer's Tea from BastionPack`, push, and open the draft PR: `gh pr create --repo marr-cloud/engineers-tea --draft --base main --head feat/v0.1 --title "Engineer's Tea 0.1" --body "Merge when 0.1 is complete. Plan: docs/plans/2026-10-25-engineers-tea-0.1.md"`.

### Task 2: Content check (lang parity, textures, quest keys)

**Files:**

- Create: `scripts/content.ts`, `scripts/content.test.ts`
- Create: `kubejs/assets/engineers_tea/lang/en_us.json`, `es_es.json`, `es_mx.json` (start as `{}`)
- Modify: `Taskfile.yml` (`check` runs `node scripts/content.ts` after `check-docs.ts`)
- Modify: `docs/troubleshooting.md` (headings for the new anchors)

**Interfaces:**

- Produces:
    - `findRegisteredItems(source: string): string[]`: ids passed to `.create('engineers_tea:<id>')` in startup script text, returned as `<id>`.
    - `checkContent(root: string): string[]`: human-readable problems; empty = ok.
    - CLI: `node scripts/content.ts` throws `BastionError` (docs `docs/troubleshooting.md#content-check`) listing problems.
- Checks: (a) the three lang files have identical key sets; (b) every registered item has `item.engineers_tea.<id>` in `en_us` and `kubejs/assets/engineers_tea/textures/item/<id>.png`; (c) every `"translate": "<key>"` inside `config/heracles/quests/**/*.json` exists in `en_us`.

- [ ] **Step 1: Write the failing tests** in `scripts/content.test.ts` (temp dirs like the template's tests):
    - `findRegisteredItems` returns `["wrought_core", "glacial_heart"]` for a source containing `e.create('engineers_tea:wrought_core')` and `e.create("engineers_tea:glacial_heart").maxStackSize(16)`, and ignores `e.create('kubejs:other')`.
    - `checkContent` reports a key missing from `es_mx` (message names the file and the key).
    - `checkContent` reports a registered item without lang key and without texture (two messages).
    - `checkContent` reports a quest `translate` key absent from `en_us`.
    - `checkContent` returns `[]` for a consistent fixture.
- [ ] **Step 2:** `mise exec -- node --test scripts/content.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement `scripts/content.ts` (regex over `kubejs/startup_scripts/**/*.js`; recursive JSON walk for `translate` values; `main()` from `scripts/lib/errors.ts`).
- [ ] **Step 4:** Run the tests again. Expected: PASS. Add the `check` line in `Taskfile.yml` and the `## Content check` heading (anchor `content-check`) with symptom, cause and fix in `docs/troubleshooting.md`.
- [ ] **Step 5:** `mise exec -- task check` and `mise exec -- task test` pass. Commit `feat: content check for lang parity, textures and quest keys`.

### Task 3: Full mod list

**Files:**

- Modify: `pakku-lock.json` (via tasks only), `pakku.json` (sides if `doctor` asks), `CHANGELOG.md`

**Interfaces:**

- Produces: the final world-affecting mod set that Tasks 4–8 rely on.

- [ ] **Step 1:** Add in one go (Pakku resolves required libraries; answer `Y`):
      `yes Y | mise exec -- task mods:add -- create farmers-delight create-central-kitchen create-enchantment-industry more-delight odyssey-quests lootr mowzies-mobs bosses-of-mass-destruction-forge l_enders-cataclysm yungs-better-dungeons yungs-better-mineshafts yungs-better-strongholds yungs-better-desert-temples yungs-better-jungle-temples yungs-better-nether-fortresses explorify dungeons-and-taverns explorers-compass artifacts gravestone-mod waystones xaeros-minimap xaeros-world-map sophisticated-backpacks appleskin chunky`
- [ ] **Step 2:** `yes Y | mise exec -- task mods:add -- prj --gh marr-cloud/ProjectE`, then try `projecte-integration`; keep it only if the instance launches with it (remove with `task mods:rm` otherwise and note why in the PR).
- [ ] **Step 3:** `mise exec -- task doctor`; fix any side mismatch in `pakku.json` (`chunky` must be server-only in the client pack or excluded from it; Xaero's are client-required, server-optional).
- [ ] **Step 4:** Confirm the lock has no `connector`/`forgified-fabric-api` and the project count (libraries included) is ≤ 130: `node -e "console.log(require('./pakku-lock.json').projects.length)"`.
- [ ] **Step 5:** `mise exec -- task build`, then `mise exec -- task server:smoke`. Expected: smoke passes (server reaches Done). Launch the instance in ElyPrism (ask the user to press Play) and confirm the main menu loads.
- [ ] **Step 6:** CHANGELOG `[Unreleased]` → `### Added`: one line per mod group (core, bosses, structures, QoL). Commit `feat: add the 0.1 mod list`.

### Task 4: Performance gate on the host laptop (with the user)

**Files:**

- Create: `docs/perf/0.1.md` (results), `server/.env` stays local (`MEMORY=4G`)

**Interfaces:**

- Consumes: Task 3 build. Produces: keep/cut decision for Cataclysm and structure mods (recorded in `docs/perf/0.1.md`).

- [ ] **Step 1:** `mise exec -- task server:up` with a **test** world (rename or remove it afterwards; the real world is generated in Task 10). Set the client heap to 5 GB in the instance settings.
- [ ] **Step 2:** Time the pregeneration through RCON: `docker compose -f server/compose.yaml exec minecraft rcon-cli "chunky radius 3000"` then `"chunky start"`; record chunks/s and total time from `task server:logs`; repeat for `chunky world minecraft:the_nether` with radius 1500 and `minecraft:the_end` with radius 1000. Record disk size of the world.
- [ ] **Step 3:** Run the acceptance test with the user (spec values: 2 players, render 8, simulation 6, 10 minutes flying/sprinting through unvisited pregenerated chunks, no freezes > ~1 s, FPS mostly ≥ 40, server MSPT < 50 most of the time). Capture `/spark health` and a 5-minute `/spark profiler` link. If only one player is available, run with one and repeat with two before release (Task 10).
- [ ] **Step 4:** If it fails, cut in the spec's order: Cataclysm (then boss 4 = Wither), then structure mods (`dungeons-and-taverns`, then `explorify`), then simulation distance. Re-run after each cut. Never lower the client heap below 4 GB.
- [ ] **Step 5:** Write `docs/perf/0.1.md` (hardware, settings, numbers, spark links, decision). Commit `docs: 0.1 performance gate results`.

### Task 5: Boss keys as items (art, lang, tooltips)

**Files:**

- Create: `kubejs/startup_scripts/items.js`, `kubejs/client_scripts/tooltips.js`
- Create: `kubejs/assets/engineers_tea/textures/item/{wrought_core,glacial_heart,gauntlet_core,infernal_ember}.png` (16×16)
- Create: `C:\Users\maurr\workspace\minecraft\engineers-tea-art\keys.lua` (Aseprite script producing the four PNGs)
- Modify: the three lang files

**Interfaces:**

- Produces: items `engineers_tea:wrought_core`, `engineers_tea:glacial_heart`, `engineers_tea:gauntlet_core`, `engineers_tea:infernal_ember` (stack size 64, rarity uncommon→epic ascending); lang keys `item.engineers_tea.<id>` and `tooltip.engineers_tea.<id>` (one line saying which boss drops it and what it unlocks, in each language).

- [ ] **Step 1:** Verify the boss entity ids from the table with `/summon` tab completion in game or the ProbeJS dump (`.probe/`); if an id differs, use the real one everywhere and fix the table in this plan.
- [ ] **Step 2:** Register the four items in `items.js` with `StartupEvents.registry('item', e => e.create('engineers_tea:<id>'))`; add tooltips in `tooltips.js` with `ItemEvents.modifyTooltips` using `Text.translate('tooltip.engineers_tea.<id>')`.
- [ ] **Step 3:** Draw the textures with `keys.lua` (run `aseprite.exe -b --script keys.lua`), copy the PNGs into the repo; add names and tooltips to `en_us`, `es_es`, `es_mx` (names from the table; Spanish identical in `es_es` and `es_mx`).
- [ ] **Step 4:** `mise exec -- task check` passes (content check sees four items, textures and keys). In game (user presses Play): `/give @s engineers_tea:wrought_core` shows the texture, the name and tooltip in English, and in Spanish after switching the language to Español (México).
- [ ] **Step 5:** Commit `feat: boss key items with art and bilingual names`.

### Task 6: Boss key drops

**Files:**

- Create: `kubejs/server_scripts/boss_keys.js`

**Interfaces:**

- Consumes: Task 5 item ids and verified entity ids.
- Produces: `BOSS_KEYS` (entity id → key item id) and range constant `KEY_RANGE = 64` in that file; later releases reuse the map.

- [ ] **Step 1:** Implement `EntityEvents.death` for the four (five with the Wither fallback, only if Task 4 cut Cataclysm) entity ids: every player in the same level within `KEY_RANGE` blocks of the boss gets one key (`player.give`); if none qualifies, spawn the key as an item at the boss position. Announce once in chat with a translatable message `message.engineers_tea.key_drop` (add to the three lang files).
- [ ] **Step 2 (Review Focus 1):** In game on the local server: `/summon` the Ferrous Wroughtnaut, move > 64 blocks away, `/kill` it by selector. Expected: one Wrought Core item on the ground at its position.
- [ ] **Step 3 (Review Focus 2):** With two players (or one player plus the check that the count is exactly one): summon it next to the player(s) and kill it. Expected: each player within range gets exactly one Wrought Core; a player in the Nether gets none.
- [ ] **Step 4:** Repeat Step 2 for each remaining boss id (summon, kill, key appears). `task check` passes. Commit `feat: bosses drop chapter keys for every nearby player`.

### Task 7: ProjectE balance (EMC and gates)

**Files:**

- Create: `config/ProjectE/custom_emc.json`
- Create: `kubejs/server_scripts/projecte_gates.js`

**Interfaces:**

- Consumes: Task 5 item ids.
- Produces: gated recipes that later chapters assume.

- [ ] **Step 1:** Learn the file format by running in game `/projecte setemc engineers_tea:wrought_core 32768` (or the fork's equivalent command; check `/projecte` tab completion), then copy the generated `config/ProjectE/custom_emc.json` into the repo. Fill it with: the four keys at the EMC from the table; **0 (no EMC)** for `create:andesite_alloy`, `create:brass_ingot`, `create:brass_nugget`, `create:brass_sheet`, `create:iron_sheet`, `create:copper_sheet`, `create:golden_sheet`, `create:polished_rose_quartz`, `create:electron_tube`, `create:precision_mechanism`, `create:sturdy_sheet`. Then confirm that 0 removes EMC (tooltip shows no EMC); if the fork treats 0 differently, use the fork's blacklist mechanism and note it in the file's `comment`.
- [ ] **Step 2:** In `projecte_gates.js` (`ServerEvents.recipes`):
    - `projecte:dark_matter`: replace the diamond-block ingredient with `engineers_tea:wrought_core` (boss 1).
    - `projecte:collector_mk1`, `projecte:relay_mk1`: replace the diamond-block ingredient with `engineers_tea:glacial_heart` (boss 2).
    - `projecte:harvest_goddess_band`: replace `projecte:iron_band` with `engineers_tea:glacial_heart` (boss 2).
    - Remove `projecte:red_matter` and `projecte:red_matter_alt`; add shaped `projecte:red_matter` with pattern `["AAA","DGD","AAA"]`, A = `projecte:aeternalis_fuel`, D = `projecte:dark_matter`, G = `engineers_tea:gauntlet_core` (boss 3).
    - `projecte:swiftwolf_rending_gale` (flight) and `projecte:watch_of_flowing_time`: replace `projecte:iron_band` / `minecraft:clock` with `engineers_tea:gauntlet_core` (boss 3).
    - Leave the transmutation table, philosopher's stone, Klein Star Ein and condenser recipes unchanged (early ProjectE).
- [ ] **Step 3 (Review Focus 4):** In game, open JEI recipes (`R`) for Dark Matter, Red Matter, Collector MK1, Relay MK1, Harvest Goddess Band, Swiftwolf's Rending Gale and Watch of Flowing Time. Expected: each shows only its gated recipe (no alternate without a key).
- [ ] **Step 4 (Review Focus 5):** Hover with the EMC tooltip over a cogwheel, a mechanical press, a precision mechanism and a brass casing. Expected: no EMC. Hover over iron, zinc, wheat, a Farmer's Delight meal and a Central Kitchen product. Expected: EMC present; if a processed food lacks EMC, add it to `custom_emc.json` at the sum of its ingredients and note it in the file's `comment`.
- [ ] **Step 5:** `task check`, `task build`, `task server:smoke` pass. CHANGELOG line. Commit `feat: ProjectE on a leash (Create intermediates without EMC, power items gated by boss keys)`.

### Task 8: Chapters 1–2 quests

**Files:**

- Create: `config/heracles/groups.txt`, `config/heracles/quests/kettle_on/*.json`, `config/heracles/quests/brass_and_steam/*.json`
- Modify: the three lang files (`quest.engineers_tea.<chapter>.<quest>.title` / `.subtitle`)

**Interfaces:**

- Consumes: Task 5 items, Task 7 gates, Task 3 mods.
- Produces: groups `kettle_on` and `brass_and_steam`, which 0.2+ extends.

- [ ] **Step 1:** Create one sample quest in game with the quest editor, save, and read the generated JSON to confirm the schema (titles are text components: use `{"translate": "<key>"}`). Test whether a `translate` key works inside `description`; if not, write descriptions as two lines, English first, then Spanish.
- [ ] **Step 2:** Write chapter 1 "Kettle On" (about 10 quests, dependency chain): welcome; andesite alloy; water wheel; mechanical press; cutting board; cooking pot; first meal; philosopher's stone; transmutation table; Explorer's Compass plus visit a dungeon (use a structure or location task if Heracles has one, otherwise obtain an item found in YUNG's dungeons). Rewards are modest (food, a few iron or copper).
- [ ] **Step 3:** Write chapter 2 "Brass & Steam" (about 10 quests): brass ingot; blaze burner; a Central Kitchen automation; a full iron or diamond armor set; three effect foods; a waystone; a backpack; a prep quest whose description tells players what to bring to the Wroughtnaut fight; kill `mowziesmobs:ferrous_wroughtnaut`; obtain `engineers_tea:wrought_core` (description mentions that Dark Matter now needs it).
- [ ] **Step 4:** `task check` passes (content check validates every `translate` key). In game: the quest book shows both chapters in English and in Spanish, the chain unlocks in order, and completing the Wroughtnaut kill quest with `/summon` plus kill works on the local server.
- [ ] **Step 5:** Commit `feat: chapters 1-2 quests (Kettle On, Brass & Steam)`.

### Task 9: Icon, docs and player setup

**Files:**

- Modify: `C:\Users\maurr\workspace\minecraft\engineers-tea-art\draw-icon.lua` and outputs; repo `docs/assets/engineers-tea-icon.png`, `kubejs/config/packicon.png` (512×512)
- Create: `docs/guides/pregenerate-world.md`
- Modify: `README.md`, `docs/players.md`, `CHANGELOG.md`

- [ ] **Step 1:** Redraw the icon closer to Builder's Tea (the user's reference) from the current mug, gear and steam icon, as original pixel art. Show the user the 512 px PNG and **wait for approval** before copying it into the repo.
- [ ] **Step 2:** `docs/guides/pregenerate-world.md` ("Use this when" / "Verify it worked"): the RCON commands from Task 4 for the three dimensions, `chunky pause` / `chunky continue`, `/worldborder set 6000` for the Overworld (and a matching border per dimension), expected time and disk from `docs/perf/0.1.md`, and the rule that structure mods are fixed before generating.
- [ ] **Step 3:** `docs/players.md`: install with ElyPrism (Ely.by account), set 4–5 GB memory, Iris optional for strong GPUs (not in the pack), how to join through the playit address. README: one paragraph on the pack loop, links to design, players and perf docs. CHANGELOG lines.
- [ ] **Step 4:** `task check` passes. Commit `docs: icon, pregeneration guide and player setup`.

### Task 10: Release 0.1 and generate the real world

- [ ] **Step 1:** If Task 4 ran with one player, repeat the acceptance test with two now. Run `task check`, `task test`, `task build`, `task doctor` and `task server:smoke`, and read the output. Mark the PR ready and ask the user to merge it.
- [ ] **Step 2:** On `main`: `mise exec -- task release -- 0.1.0`; watch the release workflow until the GitHub release has the `.mrpack`.
- [ ] **Step 3:** The user creates the Modrinth project `engineers-tea` and uploads the 0.1.0 `.mrpack` locally (`docs/guides/first-modrinth-release.md` in the repo); add the token and project id as repo secrets only if the user wants CI publishing for 0.2+.
- [ ] **Step 4:** Remove the test world, `task server:up` with the release, pregenerate following `docs/guides/pregenerate-world.md` overnight, set the world border, and take a backup (`server/backups/`). Expected: `/spark health` is normal and the border sits at the pregenerated edge.

## Follow-ups (found during execution, not part of 0.1)

- **Report the Odyssey Quests bug upstream** (ask Mauricio before posting; it is public under his account): in Heracles 2.0.0-2.0.3 the NeoForge (and Fabric) client never calls `HeraclesClient.init()`, so `Heracles.registryAccessSupplier` is null on the client and `SyncQuestsPacket.decode` throws when a player joins a dedicated server before opening any singleplayer world ("Failed to decode packet 'clientbound/minecraft:custom_payload'"). Suggested fix: call `HeraclesClient.init()` from `HeraclesNeoForgeClient.onClientSetup` (and the Fabric client entry). Repo: terrarium-earth/Heracles, branch `1.21.1`. When a fixed release ships, remove `kubejs/client_scripts/heracles_fix.js`.
- **BastionPack KubeJS guide**: document that Rhino shares one binding for `const`/`let` loop variables across iterations, so event handlers created inside a loop must be registered through a function (see `kubejs/server_scripts/boss_keys.js`).
- **BastionPack `.gitignore`**: add `/config/sodium-extra-options.json` next to the Sodium entries.
