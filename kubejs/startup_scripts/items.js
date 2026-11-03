// @ts-check

// Boss keys: one per chapter boss, given by server_scripts/boss_keys.js. Names, tooltips and
// textures live in kubejs/assets/engineers_tea/ (task check verifies they exist).
const BOSS_KEY_ITEMS = [
    ["engineers_tea:wrought_core", "uncommon"],
    ["engineers_tea:glacial_heart", "rare"],
    ["engineers_tea:gauntlet_core", "rare"],
    ["engineers_tea:infernal_ember", "epic"],
];

StartupEvents.registry("item", (event) => {
    for (const [id, rarity] of BOSS_KEY_ITEMS) {
        event.create(id).rarity(rarity);
    }
});
