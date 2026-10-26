// @ts-check

const BOSS_KEY_TOOLTIPS = ["wrought_core", "glacial_heart", "gauntlet_core", "infernal_ember"];

ItemEvents.modifyTooltips((event) => {
    for (const id of BOSS_KEY_TOOLTIPS) {
        event.add(`engineers_tea:${id}`, [Text.translate(`tooltip.engineers_tea.${id}`).gray()]);
    }
});
