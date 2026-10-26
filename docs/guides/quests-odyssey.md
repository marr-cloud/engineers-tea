# Quests with Odyssey Quests

Use this when your pack needs a quest book that works with a Modrinth-first pack.

Odyssey Quests (formerly Heracles, MIT license) is on Modrinth for Minecraft 1.21.1 NeoForge. FTB Quests, FTB Library and FTB Teams are CurseForge-only and have no declared license, so they are not suitable for a Modrinth pack.

## Add it

```sh
task mods:find -- odyssey
task mods:add -- <slug-from-the-search>
task doctor
```

Check its `side` with `task doctor` (the mod is needed on both client and server).

## Author quests

Quest data lives in the mod's config folders. Edit it in game with the quest editor and commit it (`config/` and `defaultconfigs/` are overrides). Keep quest data in one place: do not also put the same path under `.pakku/server-overrides/`.

## Verify it worked

Launch the instance and open the quest book, then `task server:smoke` passes and the quests appear for a player on the server.
