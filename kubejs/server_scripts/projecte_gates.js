// @ts-check

// ProjectE on a leash: its power items need the chapter boss keys. Each gated recipe is removed
// and re-added with the same id and pattern, with one ingredient swapped for a key, so no
// alternate recipe stays behind. The transmutation table, philosopher's stone, Klein Star Ein
// and condenser keep their normal recipes (early ProjectE).
ServerEvents.recipes((event) => {
    const gated = [
        // Boss 1 (end of chapter 2): Dark Matter and everything built from it.
        [
            "projecte:dark_matter",
            ["AAA", "AKA", "AAA"],
            { A: "projecte:aeternalis_fuel", K: "engineers_tea:wrought_core" },
        ],
        // Boss 2 (end of chapter 3): passive EMC and farming automation.
        [
            "projecte:collector_mk1",
            ["GTG", "GKG", "GFG"],
            {
                G: "minecraft:glowstone",
                T: "minecraft:glass",
                K: "engineers_tea:glacial_heart",
                F: "minecraft:furnace",
            },
        ],
        [
            "projecte:relay_mk1",
            ["OSO", "OKO", "OOO"],
            { O: "#c:obsidians/normal", S: "minecraft:glass", K: "engineers_tea:glacial_heart" },
        ],
        [
            "projecte:harvest_goddess_band",
            ["SFS", "DKD", "SFS"],
            {
                S: "#minecraft:saplings",
                F: "#minecraft:flowers",
                D: "projecte:dark_matter",
                K: "engineers_tea:glacial_heart",
            },
        ],
        // Boss 3 (end of chapter 4): Red Matter, flight and time acceleration.
        [
            "projecte:red_matter",
            ["AAA", "DKD", "AAA"],
            {
                A: "projecte:aeternalis_fuel",
                D: "projecte:dark_matter",
                K: "engineers_tea:gauntlet_core",
            },
        ],
        [
            "projecte:swiftwolf_rending_gale",
            ["DFD", "FKF", "DFD"],
            { D: "projecte:dark_matter", F: "#c:feathers", K: "engineers_tea:gauntlet_core" },
        ],
        [
            "projecte:watch_of_flowing_time",
            ["DGD", "OKO", "DGD"],
            {
                D: "projecte:dark_matter",
                G: "minecraft:glowstone",
                O: "#c:obsidians/normal",
                K: "engineers_tea:gauntlet_core",
            },
        ],
    ];
    event.remove({ id: "projecte:red_matter_alt" });
    for (const [id, pattern, keys] of gated) {
        event.remove({ id });
        event.shaped(id, pattern, keys).id(id);
    }
});
