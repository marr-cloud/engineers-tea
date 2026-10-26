# Performance on low-end machines

Use this when the pack runs slowly or runs out of memory on a modest PC.

## What the base modset already does

Sodium (rendering), ModernFix (startup and memory), FerriteCore (memory), ImmediatelyFast (UI and entity drawing), EntityCulling (skips hidden entities) and Lithium (game logic: mobs, blocks, ticking; helps singleplayer and servers). Spark is included for profiling.

The template only ships stable optimizations that do not change gameplay, following the [MC Optimization Guide](https://github.com/Polytetrafluoroethylene-PTFE/MC-Optimization-Guide) for 1.21.1. Noisium was dropped: the guide rates it as a negligible improvement.

## Memory (Java heap)

- Prism: instance Settings, Java, Maximum memory allocation. Start with 4 GB for the base modset and add as you add content mods. Far more than needed makes garbage collection slower, so do not just max it out.
- Dedicated server: `MEMORY` in `server/.env` (default `4G`).
- Modrinth App: Settings, Resource management.
- Garbage collector: keep the default G1 on PCs with less than 16 GB of RAM or an old CPU. On stronger machines `-XX:+UseZGC -XX:+ZGenerational` (Java 21) removes GC stutters at the cost of more RAM and CPU.

## Optional tweaks (off by default)

These help many packs but can break some mods, so test them in your pack before shipping the config:

- ModernFix, `config/modernfix-mixins.properties`: `mixin.perf.dynamic_resources=true` (loads models on demand; large memory savings in big packs) and `mixin.perf.faster_item_rendering=true`.
- ImmediatelyFast, `config/immediatelyfast.json`: `"experimental_screen_batching": true`.

## Per-pack mods

Not in the template because they are client-only visuals, alpha, or a matter of taste. Add them in your pack with `task mods:add -- <slug>` and run `task doctor`:

| Mod                                         | Slug                | Why it is not in the template                                                   |
| ------------------------------------------- | ------------------- | ------------------------------------------------------------------------------- |
| More Culling (leaves and block culling)     | `moreculling`       | Good on weak GPUs; set leaves culling to "Check Surrounding". Adds a dependency |
| C2ME (parallel chunk generation)            | `c2me-neoforge`     | Still alpha on NeoForge; consider it for structure-heavy servers                |
| Iris (shaders)                              | `iris`              | Shaders are a pack style choice and heavy on modest PCs                         |
| LambDynamicLights (held torches give light) | `lambdynamiclights` | Visual; costs frame rate                                                        |

## Other fixes

- Lower render distance (8 to 10) and simulation distance (5 to 8).
- Profile before guessing: run `/spark profiler` in game.
- Many added mods raise startup time; remove what you do not need with `task mods:rm -- <slug>`.
- On integrated graphics keep graphics on "Fast" and turn off clouds and biome blend.

## Verify it worked

Frame rate is steadier, memory in F3 stays below the allocated maximum, and a Spark report shows no single mod dominating the tick.
