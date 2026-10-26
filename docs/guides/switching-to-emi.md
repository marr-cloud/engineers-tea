# Switching to EMI

Use this when you want EMI as the recipe viewer instead of JEI (the template default).

## Keep JEI installed

Most mods ship a JEI plugin, not an EMI one. EMI reads JEI plugins when JEI is present, so keeping both is what makes recipes from mods like Create show up in EMI. Add-ons such as "EMI for Create" skip their own categories when JEI is installed to avoid duplicates.

Remove JEI only if every recipe-adding mod in your pack has native EMI support, and check in game afterwards.

## Steps

1. Add EMI: `task mods:add -- emi`
2. Check sides: `task doctor` (EMI is client required, server optional).
3. Launch once, open your inventory and confirm EMI's panel is there. If JEI's item list still shows next to it, hide it with JEI's overlay toggle (`Ctrl+O` by default).
4. Ship the resulting configs (under `config/`) as overrides if you changed any.

Running both viewers costs some RAM and load time. On low-end packs, test the memory budget again (see [performance](performance-low-end.md)).

## Verify it worked

Pressing `R` on an item opens EMI's recipe screen, recipes from your content mods (for example Create's mixing and pressing) appear there, and `task doctor` shows no side mismatch.
