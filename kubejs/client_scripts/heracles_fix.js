// @ts-check

// Workaround for Odyssey Quests (Heracles) 2.0.0-2.0.3: the NeoForge client never calls
// HeraclesClient.init(), so its registry access stays unset until a singleplayer world starts.
// Joining a dedicated server first then disconnects with "Failed to decode packet
// 'clientbound/minecraft:custom_payload'" (heracles sync_quests). init() only sets that
// supplier, so calling it at client startup is safe. Remove once a fixed Odyssey Quests ships.
Java.loadClass("earth.terrarium.heracles.client.HeraclesClient").init();
