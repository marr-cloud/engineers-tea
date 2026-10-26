# Engineer's Tea: pack design

Status: draft for approval (2026-10-25). First group session: around 2026-11-25. Author: Mauricio (meitrix8208) with Claude.
This document moves into the pack repo as `docs/design.md` when the repo is created
(`docs/superpowers/` is removed by the template's `task init`, so it does not live there).

## Intent

A relaxed Create pack for a small group of friends (all systems engineers, bilingual
English/Spanish) playing on Mauricio's home server. The hook is a loop of
**build at home → explore a dungeon → beat a boss → bring its material home → automate it
→ build better → next boss**, ending in crafting the pack's namesake item, the
**Engineer's Tea**. The pack is for this group first; other players are welcome but not the
target, so it optimizes for the group's fun, not for broad appeal.

Inspirations (ideas only, no mod lists copied):

- **Farming Experience** (Modrinth, NeoForge 1.21.1): cozy Farmer's Delight farming and cooking.
- **CABIN** (ThePansmith, Forge 1.20.1/CurseForge): chapter-based progression where KubeJS
  recipe chains and quests drive Create.
- **Deceivers & Dungeons** (Modrinth): structures and bosses. Its 180-mod, Connector-based
  stack is the opposite of what this pack wants; only the "dungeons and bosses everywhere"
  feeling is borrowed.

## Players, length, constraints

- 3–5 friends (exact count unknown; design for 2–5). Two sessions a week for **4–6 weeks**:
  about 8–12 sessions, 20–30 hours to the ending.
- **Weakest machine = the host.** Mauricio's laptop: Ryzen 5 4500U (6 cores, 15 W), Radeon
  integrated graphics (shares system RAM), 16 GB RAM. It runs the **client and the server at
  the same time** (Docker itzg + playit.gg; Docker capped at ~7.4 GB).
- Built on the **BastionPack** template (marr-cloud/BastionPack 0.3.0): Minecraft 1.21.1,
  NeoForge, Pakku, 100% Modrinth. The one exception is ProjectE, which comes from the
  marr-cloud/ProjectE GitHub release via `task mods:add -- prj --gh marr-cloud/ProjectE`
  (verified to export into the .mrpack).
- Friends join with Ely.by accounts through ElyPrism; the server runs with
  `AUTH_SERVER=ely.by` (already supported by the template).
- **No Sinytra Connector / Fabric-on-NeoForge mods.** Reliability comes first.
- BastionPack's mod rule still applies to the base: the template's perf and dev mods stay;
  everything else is content chosen here.

## Goals

1. **Fast, interesting first session.** Within the first evening players have working Create
   machines and Farmer's Delight food with effects, not hours of punching trees.
2. **Something to do in every direction.** Roughly "a dungeon per biome": exploration from
   any base location finds structures with loot and fights within a short walk.
3. **Bosses are a challenge won by preparation, not by repetition.** Arriving with the
   current chapter's gear and food makes a boss beatable with effort as a group; arriving
   under-prepared is clearly hard.
4. **Boss drops feed the factory.** Each boss drops a chapter key material that unlocks the
   next tier of machines, gear and ProjectE items, and can be duplicated forever afterwards.
5. **A celebratory, inclusive ending** (see "The ending").
6. **Bilingual text**: everything the pack adds (item names, tooltips, quests) exists in
   English and Spanish; Spanglish flavor is welcome.

## Non-goals

- Pleasing every player type, expert-pack difficulty, or 100+ hours of content.
- Shaders by default (Iris can be an optional client add for friends with better GPUs).
- New dimensions or custom areas (a possible v2 idea).
- CurseForge publishing.

## Anti-goals (failure even if it technically works)

- **Lag or stutter on the host laptop** with the server running.
- **Frustration**: losing everything on death far from home, bosses that need ten attempts,
  grinding without a goal.
- ProjectE letting players skip Create or skip chapters.
- Client/server mod mismatch when joining (the reason a previous CABIN attempt failed). Client
  and server must come from the same .mrpack (the template already guarantees this).

## Performance budget (hard constraint)

- Client heap 4–5 GB; server heap 3–4 GB in Docker, both on the host laptop.
- Target **100–130 mods** total (for reference: Farming Experience 98, Deceivers & Dungeons 180).
- World generation is the main server cost: prefer light structure mods; **no When Dungeons
  Arise or other giant-structure mods**. L'Ender's Cataclysm is allowed only if it passes the
  acceptance test.
- **The world is pregenerated (decided).** Chunky (Modrinth, NeoForge 1.21.1, server side)
  pregenerates the Overworld, and the Nether/End areas the chapters need, on the host
  overnight before the first session; a vanilla `/worldborder` keeps play inside it.
  Starting radius about 3000 blocks in the Overworld (the builder tunes the radius per
  dimension to fit disk and time). Document the steps in the pack's server guide.
- **Acceptance test** (on the host laptop, server running in Docker, 2 players connected,
  render distance 8, simulation 6, inside the pregenerated area): flying/sprinting through
  unvisited (but pregenerated) chunks for 10 minutes keeps the client playable (no freezes
  over ~1 s; FPS mostly ≥ 40) and the server's spark health shows MSPT < 50 most of the
  time. Run it after adding the structure and boss mods, and before every release. Record
  the spark links in the PR. Also time the pregeneration (it must finish overnight). If the
  test fails, cut in this order: Cataclysm, then structure density or structure mods, then
  simulation distance; do not lower the client heap below 4 GB.

## The core loop and chapters

Five chapters. Chapter 1 has no boss; chapters 2–5 end with one. A chapter is about 2–3
sessions. Bosses climb a difficulty ladder and live in different biomes/dimensions so
exploration naturally leads to them.

| Chapter          | Theme                                                                                           | Boss gate (end of chapter)                                                                | Unlocks after the boss                 |
| ---------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------- |
| 1. Kettle On     | Create andesite age, first Farmer's Delight farms, early transmutation, first dungeons for loot | none                                                                                      | —                                      |
| 2. Brass & Steam | Brass, Central Kitchen food automation, better tools                                            | early boss (Mowzie's Mobs tier, e.g. Ferrous Wroughtnaut)                                 | ProjectE Dark Matter tier, tier-2 gear |
| 3. ...           | mid factory (builder names the chapter)                                                         | mid boss (Mowzie's or Bosses of Mass Destruction tier)                                    | tier-3 gear, more ProjectE items       |
| 4. ...           | Nether-facing chapter                                                                           | harder boss (Bosses of Mass Destruction tier, Nether or End)                              | Red Matter tier, flight/travel items   |
| 5. Last Pour     | endgame factory                                                                                 | final boss (Cataclysm tier if it passes the perf test, otherwise the strongest available) | Engineer's Tea recipe                  |

Decided: five chapters, chapter 1 boss-free, ascending ladder across biomes, the chapter-5
gate leads to the Engineer's Tea. **Left to the builder:** exact boss per chapter (from the
candidate pool), chapter names 3–4, and the recipe content of each tier, as long as each
chapter's gear is what makes its boss fair.

### Chapter key materials

Each boss drops **a custom key material made with KubeJS** (bilingual name, e.g. "Wrought
Core"), added to the boss's loot with LootJS (one guaranteed drop per kill **for every
nearby player**, so the group is not fighting over it). Using our own items instead of the
mods' native drops keeps recipes independent of each boss mod and lets a boss be swapped
without rewriting the progression. Key materials gate the next tier's recipes and have EMC
(see below), so after the first kill they can be duplicated.

## ProjectE rules (decided)

ProjectE is available **early, on a leash**: it speeds up Create and never replaces it.

- **Chapter 1**: the transmutation table is craftable early. Basic resources (iron, copper,
  zinc, wood, stone, crops, food) have EMC so players skip boring gathering.
- **EMC income comes from the factory**: farms and Create lines (crops, processed food) are
  the main EMC source. Passive EMC (Energy Collectors) is gated to a later chapter.
- **Create's own intermediates** (andesite alloy, brass, precision mechanisms and similar)
  have **no EMC or a very high EMC**, so the lines still have to be built. Set via
  `config/ProjectE/custom_emc.json` (shipped as an override; verified the fork reads it).
- **Power items are gated by chapter** through KubeJS recipe changes that require key
  materials: Dark Matter after boss 1, Red Matter after boss 3 (chapter 4), rings/Klein stars/
  collectors later. Anything that trivializes a chapter goes behind the matching gate or is
  removed.
- **Key materials**: ProjectE only lets you learn an item you have held, so a key material is
  not transmutable until its boss is beaten once; afterwards it can be made from EMC forever.
  This is the "get it once, duplicate it forever" mechanic; no extra code needed.
- **EMC values of key materials** are tuned by playtesting (too cheap trivializes the next
  chapter; too expensive makes the duplication line pointless). Starting values are the
  builder's call.
- The Engineer's Tea has **no EMC** (not transmutable).

## The ending (decided)

The **Engineer's Tea** is a KubeJS item (bilingual name and tooltip, enchantment glint),
crafted from all four key materials plus endgame Create/Farmer's Delight products.

1. **First drink per player** (tracked per player): server-wide announcement, fireworks, a
   final advancement, and a **permanent, modest buff** (for example slightly faster mining
   and night vision) that survives death and relog.
2. **Later drinks** are just a nice tea: no announcement, no new effect, at most a short
   regeneration.
3. **The first tea crafted on the server unlocks a cheap recipe** (for example a teapot) so
   every friend can get their own, even if they missed some fights. Nobody is excluded.
4. **Players who have drunk their first tea can craft Create's creative items** (creative
   motor, creative crate and similar): the base becomes a sandbox afterwards.
5. **Trophy**: a tea placed in an invisible item frame on a wall (glint plus custom name).
   Provide a way to get an invisible item frame (recipe or reward); no custom block needed.

## Language

- KubeJS lang files `en_us` and `es_es` for every item, tooltip and message the pack adds, with the Spanish file copied to `es_mx` (and other `es_*` locales players use), since Minecraft does not fall back from `es_mx` to `es_es` (my call).
  Spanglish flavor in names is fine.
- Quests in both languages. **Builder verifies** whether Odyssey Quests supports translation
  keys; if not, quest text is written bilingually in one string (English first).

## Mods

Availability below was checked on Modrinth for NeoForge 1.21.1 on 2026-10-25.

**Decided (core):** Create 6.0.10, Farmer's Delight, Create: Central Kitchen, ProjectE (fork,
`--gh`), Odyssey Quests (beta 2.0.3), Lootr (per-player dungeon loot, essential for
multiplayer), KubeJS + LootJS (server-only) + the template base (Sodium, ModernFix,
FerriteCore, ImmediatelyFast, EntityCulling, Lithium, JEI, Jade, spark, Crash Assistant,
ProbeJS).

**Candidate pool** (the builder picks within the performance budget and justifies each pick
in the PR):

- Bosses: Mowzie's Mobs (early/mid; biome-bound bosses), Bosses of Mass Destruction (mid/
  late), L'Ender's Cataclysm (late; heavy, perf test required). Vanilla Wither and Ender
  Dragon are free fallbacks.
- Structures (light, spread across biomes): YUNG's Better Dungeons/Mineshafts/Strongholds/
  Desert Temples/Jungle Temples/Nether Fortresses/Ocean Monuments, Explorify, Dungeons and
  Taverns, Towns and Towers, Moog's Voyager Structures. Explorer's Compass to find them.
- Gear and prep: Artifacts (boss-specific helpers such as fire resistance), Farmer's Delight
  add-ons with effect foods (More Delight, Expanded Delight), Create add-ons that fit the
  tiers (Create Enchantment Industry, Create Crafts & Additions, Create Deco, Create Stuff
  'N Additions).
- Anti-frustration and QoL: a grave mod (Corpse or GraveStone), Waystones (travel back to
  dungeons), a minimap/world map (Xaero's or JourneyMap), Sophisticated Backpacks/Storage,
  AppleSkin, Open Parties and Claims.
- ProjectE Integration (EMC for other mods' recipes) if it works with the fork.
- Mystical Agriculture: **left out by default** (my call): it is a second resource-generation
  system that competes with both ProjectE and Create. Revisit only if a chapter feels thin.

Not available on Modrinth (excluded): Twilight Forest, FTB Quests, Create Slice & Dice,
Dungeon Crawl, Integrated Dungeons and Structures.

## Icon

Redraw the Engineer's Tea icon to look **closer to Builder's Tea** (the reference Mauricio
shared), still original pixel art made in Aseprite (`C:\meitrix\aseprite\aseprite.exe`, files in
`C:\Users\maurr\workspace\minecraft\engineers-tea-art\`). The current icon (copper mug,
brass gear, steam) is the starting point. The same art is used for the item texture of the
Engineer's Tea.

## World persistence (decided)

The group's world lives from the first session to the ending; it is never reset.

- **Every mod that adds blocks, worldgen, structures or bosses ships in 0.1**, including the
  bosses of chapters 3–5, so everything exists in the pregenerated world from day one.
  Removing a content mod later deletes its blocks and items from the world, so it needs a
  migration note and a world backup first.
- Later releases add chapters through recipes, quests, KubeJS items, EMC values and configs,
  plus mods that add no worldgen.
- The boss-per-chapter assignment and all four key materials are decided before 0.1, even
  if their recipes and quests land in later releases.

## Delivery

- Create `marr-cloud/engineers-tea` from the BastionPack template; `task init` with creators
  `meitrix8208` and the repo's issues as help link.
- **Ship in slices** (my call), with about a month before the first session: 0.1 (before
  2026-11-25) contains the full mod list, the pregeneration setup, the boss assignment for
  all chapters, and chapters 1–2 complete (recipes, ProjectE gates, quests, key material 1).
  Each later release adds one chapter's recipes and quests; 0.4 adds chapter 5 and the
  Engineer's Tea. Releases stay ahead of the group (about one chapter per 1–1.5 weeks of
  play).
- The first Modrinth upload is done locally by Mauricio (he creates the Modrinth project and
  token); after that the template's release workflow publishes.
- Every release passes `task check`, `task test`, `task build`, `task doctor`, the CI server
  smoke test, and the performance acceptance test above.

## Left to the builder

Exact mod picks from the candidate pool, boss-per-chapter assignment, recipe and quest
content per chapter, starting EMC values, the buff's exact numbers, chapter names 3–4,
the teapot recipe, and how first-drink tracking is stored.
