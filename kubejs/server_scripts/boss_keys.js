// @ts-check

// Every chapter boss gives its key to each player within KEY_RANGE blocks in the same
// dimension, so the group never fights over it. If nobody is in range (the boss died to lava,
// a fall or another mob), the key drops at the boss so it is never lost.
const KEY_RANGE = 64;
const BOSS_KEYS = {
    "mowziesmobs:ferrous_wroughtnaut": "engineers_tea:wrought_core",
    "mowziesmobs:frostmaw": "engineers_tea:glacial_heart",
    "bosses_of_mass_destruction:gauntlet": "engineers_tea:gauntlet_core",
    "cataclysm:ignis": "engineers_tea:infernal_ember",
};

for (const [boss, key] of Object.entries(BOSS_KEYS)) {
    EntityEvents.death(boss, (event) => {
        const entity = event.entity;
        // A plain loop: the players list is a Java list, not a JS array.
        const nearby = [];
        for (const p of event.level.players) if (p.distanceTo(entity) <= KEY_RANGE) nearby.push(p);
        if (nearby.length === 0) {
            entity.block.popItem(Item.of(key));
        } else {
            for (const player of nearby) player.give(Item.of(key));
        }
        event.server.tell(
            Text.translate(
                "message.engineers_tea.key_drop",
                entity.displayName,
                Text.translate(`item.${key.replace(":", ".")}`),
            ).gold(),
        );
    });
}
