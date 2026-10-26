# KubeJS recipes and optional compat

Use this when you want to change recipes with KubeJS, or support a mod that may or may not be installed.

KubeJS here runs **JavaScript only** (Rhino), not TypeScript. Scripts live in `kubejs/server_scripts/` (recipes, tags, loot), `kubejs/startup_scripts/` and `kubejs/client_scripts/`. `kubejs/README.txt` explains each folder.

## Editor typings

1. Launch the game with ProbeJS installed (it is client-side only and not exported).
2. In a world run `/probejs dump`. Typings are written to `.probe/` (gitignored).
3. Open the repository root in VS Code. Put `// @ts-check` at the top of a script for type hints.
4. Optional: `task check:types` type-checks scripts against the typings (needs `.probe/`).

The dump also writes VS Code Copilot agents to `.github/agents/kubejs-*.agent.md`. They use the ProbeJS VS Code extension and are regenerated on every dump, so they are gitignored.

`task check` lints scripts with oxlint, including the example rule `bastion/no-empty-recipe-remove` (never call `event.remove({})` with no filter).

## Optional compat pattern

Guard everything that touches another mod so the script still loads without it:

```js
// @ts-check

if (Platform.isLoaded("create")) {
    ServerEvents.recipes((event) => {
        event.remove({ id: "create:crushing/diorite" });
    });
}
```

Use `Platform.isLoaded('modid')` with the mod id (not the Modrinth slug). Referencing an item from a missing mod inside a recipe makes the script error, so keep all such recipes inside the guard.

## Reload and test

`/reload` reloads server scripts; startup scripts need a restart. Errors are in `logs/kubejs/`.

## Verify it worked

The recipe change shows in JEI, `logs/kubejs/server.log` has no errors, and with the optional mod removed the pack still starts (`task server:smoke`).
