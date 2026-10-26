# Wrong mod side

Use this when `task doctor` reports a side mismatch, a client crashes with a missing mod, the server crashes loading a client-only mod, or players are told a mod "is not installed on the client".

## Why it happens

Pakku derives each mod's `side` from Modrinth metadata and gets it wrong for some mods (Pakku issue #131). Example: Create is tagged client-optional / server-required, which Pakku maps to `SERVER`, so the `.mrpack` marks it `client: unsupported` and the client never loads it.

## Fix

1. Run `task doctor`. It compares the lock with Modrinth and prints a snippet like:

    ```json
    "projects": {
        "create": { "side": "BOTH" }
    }
    ```

2. Merge that into `projects` in `pakku.json` (keep existing entries). Or run `java -jar pakku.jar cfg prj -s BOTH <slug>` (the flag goes before the slug).
3. Rebuild: `task build`.

Explicit overrides on mods Modrinth tags as both-sides are intentional and are not flagged. `export_server_side_projects_to_client` is `false` by default and Pakku does not write default values to `pakku.json`.

Last resort for the server only: list the jar in `MODRINTH_EXCLUDE_FILES` in `server/.env`. Prefer fixing `side`, because the published pack stays wrong otherwise.

## Verify it worked

`task doctor` reports "Mod sides match Modrinth" (or only your intentional overrides), `task build` succeeds and `task server:smoke` reaches the ready line.
