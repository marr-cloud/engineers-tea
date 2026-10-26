# Server rejects connection

Use this when a player cannot join the server: "mod mismatch", "missing mods", "incompatible", a version error or a timeout.

## Find the cause

1. **Different pack versions.** The player must have the exact version the server runs. Server: `task server:logs`, look for the pack version at startup. Player: update the instance to that version.
2. **Extra or missing mods on the client.** Remove mods the player added themselves (see [players](../players.md)); reinstall the pack.
3. **Wrong side on a mod.** If the error names one mod, check its side ([wrong-mod-side](wrong-mod-side.md)). Both client and server are built from the same lock, so a mismatch is almost always a wrong `side`.
4. **Server did not pick up the new pack.** `task server:update` pulls images and forces a modpack resync.
5. **Timeout / cannot reach.** The server is not running (`task server:logs`), or the playit tunnel is down or points to the wrong local address. It must be `minecraft:25565` ([local-server-docker](local-server-docker.md)).

6. **"Failed to verify username" with an Ely.by (or other third-party) account.** The server checks sessions against Mojang unless told otherwise. Set `AUTH_SERVER`: [troubleshooting](../troubleshooting.md#failed-to-verify-username).

## Verify it worked

The player joins, and `task server:logs` shows the join line without errors.
