# Pregenerate the world

Use this when you start the group's world on the local server, before the first session, so exploring never makes the server generate terrain while people play.

Chunky (server-only, already in the pack) generates the chunks ahead of time; a vanilla world border keeps play inside them. Everything a chunk contains, including YUNG's and Explorify structures and boss arenas, is created during this pass, so the structure and boss mods must be final before you start: a mod added later only appears outside the border.

## Steps

1. Start the server with the release you will play: `task server:up`.
2. Run the commands through RCON (itzg enables it; the container is named after the Docker project):

    ```sh
    docker exec engineers-tea-minecraft-1 rcon-cli "chunky world minecraft:overworld"
    docker exec engineers-tea-minecraft-1 rcon-cli "chunky center 0 0"
    docker exec engineers-tea-minecraft-1 rcon-cli "chunky radius 3000"
    docker exec engineers-tea-minecraft-1 rcon-cli "chunky start"
    ```

3. Follow progress with `task server:logs`. Pause with `rcon-cli "chunky pause"` and resume another night with `rcon-cli "chunky continue"`; progress survives restarts.
4. When the Overworld is done, repeat step 2 for the Nether with `chunky world minecraft:the_nether` and radius `400`. The End has no chapter boss, so it is generated live when players go there.
5. Set the borders. The vanilla border is a diameter, so it is twice the radius:

    ```sh
    docker exec engineers-tea-minecraft-1 rcon-cli "worldborder set 6000"
    ```

    Vanilla shares one border across dimensions, scaled by their coordinate scale: with `6000` in the Overworld the Nether border is `750` (radius 375), which is why the Nether radius above is `400`. A bigger Nether needs a bigger Overworld border.

6. Back up the world (see the local server guide's backup section) before the first session.

Expected time and disk for this pack on the host laptop are recorded in [docs/perf/0.1.md](../perf/0.1.md). If generation is too slow for one night, lower the radius; you can grow it later with another Chunky run and a larger border.

## Verify it worked

`chunky` reports 100% for each dimension, `/worldborder get` shows `6000`, and flying to the border in game loads terrain without the server's `/spark health` showing MSPT spikes.
