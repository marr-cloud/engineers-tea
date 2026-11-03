import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { checkContent, findRegisteredItems } from "./content.ts";

const LANG = "kubejs/assets/engineers_tea/lang";
const TEXTURES = "kubejs/assets/engineers_tea/textures/item";
let root: string;

function put(file: string, content: string) {
    mkdirSync(join(root, file, ".."), { recursive: true });
    writeFileSync(join(root, file), content);
}

function langs(keys: Record<string, string>, overrides: Record<string, object> = {}) {
    for (const l of ["en_us", "es_es", "es_mx"]) {
        put(`${LANG}/${l}.json`, JSON.stringify(overrides[l] ?? keys));
    }
}

beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "content-test-"));
    put(
        "kubejs/startup_scripts/items.js",
        "StartupEvents.registry('item', e => {\n    e.create('engineers_tea:wrought_core')\n})\n",
    );
    put(`${TEXTURES}/wrought_core.png`, "png");
    langs({ "item.engineers_tea.wrought_core": "Wrought Core" });
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

test("findRegisteredItems returns engineers_tea ids and ignores other namespaces", () => {
    const src = `e.create('engineers_tea:wrought_core')\ne.create("engineers_tea:glacial_heart").maxStackSize(16)\ne.create('kubejs:other')`;
    assert.deepEqual(findRegisteredItems(src), ["wrought_core", "glacial_heart"]);
});

test("ids listed in an array and created in a loop are found", () => {
    const src = `const IDS = [["engineers_tea:wrought_core", "uncommon"], ["engineers_tea:glacial_heart", "rare"]];
for (const [id] of IDS) e.create(id);`;
    assert.deepEqual(findRegisteredItems(src), ["wrought_core", "glacial_heart"]);
});

test("a consistent pack has no problems", () => {
    assert.deepEqual(checkContent(root), []);
});

test("a key missing from es_mx is reported with file and key", () => {
    langs(
        { "item.engineers_tea.wrought_core": "Wrought Core", "message.engineers_tea.x": "X" },
        { es_mx: { "item.engineers_tea.wrought_core": "Núcleo Forjado" } },
    );
    const problems = checkContent(root);
    assert.equal(problems.length, 1);
    assert.match(problems[0] ?? "", /es_mx\.json/);
    assert.match(problems[0] ?? "", /message\.engineers_tea\.x/);
});

test("a registered item without lang key and texture gives two problems", () => {
    put("kubejs/startup_scripts/more.js", "e.create('engineers_tea:glacial_heart')");
    const problems = checkContent(root);
    assert.equal(problems.length, 2);
    assert.ok(problems.some((p) => p.includes("item.engineers_tea.glacial_heart")));
    assert.ok(problems.some((p) => p.includes("glacial_heart.png")));
});

test("a quest translate key missing from en_us is reported", () => {
    put(
        "config/heracles/quests/kettle_on/welcome.json",
        JSON.stringify({
            display: { title: { translate: "quest.engineers_tea.kettle_on.welcome.title" } },
        }),
    );
    const problems = checkContent(root);
    assert.equal(problems.length, 1);
    assert.match(problems[0] ?? "", /quest\.engineers_tea\.kettle_on\.welcome\.title/);
    assert.match(problems[0] ?? "", /welcome\.json/);
});

test("a malformed lang file is reported, not thrown", () => {
    put(`${LANG}/es_es.json`, "{not json");
    const problems = checkContent(root);
    assert.ok(problems.some((p) => p.includes("es_es.json")));
});

// Odyssey Quests stores titles as a JSON text component inside a string.
test("a translate key inside a stringified title is checked", () => {
    put(
        "config/heracles/quests/kettle_on/welcome.json",
        JSON.stringify({
            display: { title: JSON.stringify({ translate: "quest.engineers_tea.missing" }) },
        }),
    );
    const problems = checkContent(root);
    assert.equal(problems.length, 1);
    assert.match(problems[0] ?? "", /quest\.engineers_tea\.missing/);
});
