# Local server with Docker

Use this when you want to host the pack for friends from your own PC using Docker and playit.gg.

`server/compose.yaml` runs `itzg/minecraft-server:java21` (it installs the pack from the same `.mrpack` friends use) and the playit.gg agent `ghcr.io/playit-cloud/playit-agent:1.0.8`.

## Setup

1. Install Docker Desktop and start it.
2. Create the env file and fill it in:

    ```sh
    cp server/.env.example server/.env
    ```

    Set `PLAYIT_SECRET_KEY` (playit.gg dashboard, Agents). `MEMORY` defaults to 4G. Never commit `server/.env`.

3. In the playit dashboard set the tunnel's local address to `minecraft:25565`. The agent shares the compose network with the server, so the service name is the address.

## Run

```sh
task server:up
task server:logs
```

`task server:up` builds a dev pack and starts both containers. `task server:up SERVER_USE_ENV_PACK=true` skips the build and uses `MODRINTH_MODPACK` from `server/.env` instead (a `/modpacks/<file>.mrpack` path, or a published Modrinth slug with `MODRINTH_VERSION`). Friends join through the playit address.

Other commands:

- `task server:update`: pull images and force a modpack resync after a new build.
- `task server:down`: stop everything. The world stays in the Docker volume `bastionpack_minecraft-data`.
- `task server:smoke`: boot a throwaway server from the built `.mrpack` and wait for the ready line (this is the CI check).

## World data and backups

The server keeps `/data` (world, configs, installed mods) in the named volume `engineers-tea_minecraft-data`, not in a folder of the repo. A bind mount from Windows makes the NeoForge install and world saves very slow on Docker Desktop.

Copy the world out (works while the server runs; stop it first for a consistent copy):

```sh
docker compose -f server/compose.yaml cp minecraft:/data/world server/backups/world
```

Start over with a fresh world: `task server:down`, then `docker volume rm engineers-tea_minecraft-data`. Never do this to the group's world.

### Automatic backups

The `backups` service ([itzg/mc-backup](https://github.com/itzg/docker-mc-backup)) saves the world every day at 05:00 (host time) into `server/backups/` as `.tar.zst` files and deletes those older than 7 days. It asks the server over RCON to flush and pause saving while it copies, so the copy is consistent while people play.

1. Give RCON a fixed password both services share: create `server/rcon.env` (gitignored) with one line, `RCON_PASSWORD=<long random string>` (for example from `openssl rand -hex 24`).
2. Start the server with the profile: `COMPOSE_PROFILES=backups task server:up`, or add `COMPOSE_PROFILES=backups` to `server/.env`.
3. Change the schedule, retention or folder with `BACKUP_CRON`, `BACKUP_KEEP_DAYS` and `BACKUP_DIR` in `server/.env`.

Take one now (before a risky change): `docker exec engineers-tea-backups-1 backup now`.

Restore: stop the server, delete the volume's `world` folder and extract a backup into it. For example, with the server stopped:

```sh
docker run --rm -v engineers-tea_minecraft-data:/data -v "$PWD/server/backups:/backups:ro" alpine sh -c "apk add -q zstd tar && rm -rf /data/world && tar -C /data -xf /backups/<file>.tar.zst"
```

`MODRINTH_EXCLUDE_FILES` (comma-separated jar names) is a fallback to skip a file on the server. Prefer fixing the mod's `side` ([wrong-mod-side](wrong-mod-side.md)).

## Ely.by and other auth servers

Use this when players log in with Ely.by (or another authlib-injector / Yggdrasil account system) and get "Failed to verify username". A launcher that injects authlib-injector into the client is not enough: the server checks every session itself, and by default it asks Mojang.

1. In `server/.env` set `AUTH_SERVER=ely.by` (or an `https://` Yggdrasil API URL).
2. Run `task server:up`. It downloads the pinned authlib-injector into `build/authlib/` (checked against `AUTHLIB_SHA256` in `Taskfile.yml`) and starts the server with it.
3. `task server:logs` shows `Authentication server: https://ely.by`.

Everyone must then use an account of that auth server; Mojang/Microsoft accounts are rejected. Leave `AUTH_SERVER` empty to go back to Mojang.

## Verify it worked

`task server:logs` shows `Done (...)! For help, type "help"`, and a player joins through the playit address. If not, see [server-rejects-connection](server-rejects-connection.md) and [troubleshooting](../troubleshooting.md#docker-missing).
