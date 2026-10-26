# Pregenerate the world

Use this when you start the group's world on the local server, before the first session, so exploring never makes the server generate terrain while people play.

Chunky (server-only, in the pack) generates the chunks ahead of time; DimWorldBorder (server-only, in the pack) puts a border on each dimension so play stays inside them. Everything a chunk contains, including structures and boss arenas, is created during this pass, so the structure and boss mods must be final before you start: a mod added later only appears outside the border.

Sizes: Overworld radius 3000, Nether radius 1500. The End has no chapter boss and is generated live when players go there.

All commands run through RCON (itzg enables it; the container is named after the Docker project), from any terminal:

```sh
docker exec engineers-tea-minecraft-1 rcon-cli "<command>"
```

## 1. Check the seed

Structures depend on the seed. Start the server with the release you will play (`task server:up`), then make sure every chapter boss is inside the borders:

```sh
docker exec engineers-tea-minecraft-1 rcon-cli "execute in minecraft:overworld run locate structure mowziesmobs:wrought_chamber"
docker exec engineers-tea-minecraft-1 rcon-cli "execute in minecraft:overworld run locate structure mowziesmobs:frostmaw_spawn"
docker exec engineers-tea-minecraft-1 rcon-cli "execute in minecraft:the_nether run locate structure bosses_of_mass_destruction:gauntlet_arena"
docker exec engineers-tea-minecraft-1 rcon-cli "execute in minecraft:the_nether run locate structure cataclysm:burning_arena"
```

The first two must be within 3000 blocks of 0, 0 on both axes and the last two within 1500. If one is not, and only before the group has played: run `task server:down`, delete the world with `docker volume rm engineers-tea_minecraft-data`, set a different `SEED` in `server/.env` (any number; empty means random) and start again.

## 2. Generate

```sh
docker exec engineers-tea-minecraft-1 rcon-cli "chunky world minecraft:overworld"
docker exec engineers-tea-minecraft-1 rcon-cli "chunky center 0 0"
docker exec engineers-tea-minecraft-1 rcon-cli "chunky radius 3000"
docker exec engineers-tea-minecraft-1 rcon-cli "chunky start"
```

Follow progress with `task server:logs`. Pause with `rcon-cli "chunky pause"` and resume another night with `rcon-cli "chunky continue"`; progress survives restarts. When the Overworld is done, repeat with `chunky world minecraft:the_nether` and radius `1500`.

## 3. Set the borders

The border size is a diameter (twice the radius):

```sh
docker exec engineers-tea-minecraft-1 rcon-cli "dimworldborder minecraft:overworld set 6000"
docker exec engineers-tea-minecraft-1 rcon-cli "dimworldborder minecraft:the_nether set 3000"
```

Vanilla shares one border across dimensions (the Nether gets an eighth of the Overworld's), which would put the Nether border at 375 blocks, too small for its boss arenas; DimWorldBorder sets each dimension on its own.

## 4. Back up

Back up the world (see the local server guide's backup section) before the first session.

Measured time and disk for this pack on the host laptop are in [docs/perf/0.1.md](../perf/0.1.md). If generation is too slow for one night, pause and continue the next night.

## Verify it worked

Chunky reports `Task finished` for both dimensions, `dimworldborder minecraft:overworld get` shows `6000` and `dimworldborder minecraft:the_nether get` shows `3000`, and flying to a border in game loads terrain without the server's `/spark health` showing MSPT spikes.
