// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// Post-combat loot. For now loot is fully RANDOMIZED from the general card pool
// (rarity-weighted), not tied to per-enemy tables — that keeps the pool wide.
// (Enemy lootTables still live in data/enemies.js for a future "elevated chance
// to drop a signature card" pass.) Tune counts/weights via LOOT_CONFIG in
// main.js. Taking loot appends instances to the master deck (the backpack).
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

function lootConfig() {
  return typeof LOOT_CONFIG !== "undefined"
    ? LOOT_CONFIG
    : { dropsPerFight: 3, rarityWeight: { common: 6, uncommon: 3, rare: 1 } };
}

// Every card whose rarity has a loot weight can drop — excludes starters and the
// enemy-only "special" cards automatically (they have no weight).
function lootPoolIds(rarity) {
  return Object.keys(cardTemplates).filter((id) => cardTemplates[id].rarity === rarity);
}

// One random loot card: pick a rarity by weight, then a random card of it.
function randomLootCard() {
  const weights = lootConfig().rarityWeight;
  const rarities = Object.keys(weights).filter((r) => lootPoolIds(r).length);
  const total = rarities.reduce((a, r) => a + weights[r], 0);
  let roll = Math.random() * total;
  let rarity = rarities[rarities.length - 1];
  for (const r of rarities) { if (roll < weights[r]) { rarity = r; break; } roll -= weights[r]; }
  const pool = lootPoolIds(rarity);
  return makeCard(pool[randInt(0, pool.length - 1)]);
}

// Aggregate drops for the just-finished combat: N random cards + credits.
function generateCombatLoot(s) {
  const ctx = s.currentCombat.rewardContext;
  const rolls = s.currentCombat.doubleLoot ? 2 : 1; // Artifact Scanner
  const n = Math.max(0, Math.round(lootConfig().dropsPerFight)) * rolls;

  const cards = [];
  for (let i = 0; i < n; i++) cards.push(randomLootCard());

  let credits = 0;
  ctx.killedEnemies.forEach((e) => { if (e.creditsOnKill) credits += e.creditsOnKill; });

  return { cards, credits };
}

// Move the chosen loot instances into the deck.
function takeLoot(instanceIds) {
  const take = new Set(instanceIds);
  const taken = state.pendingLoot.filter((c) => take.has(c.instanceId));
  taken.forEach((c) => state.player.deck.push(c));
  state.pendingLoot = state.pendingLoot.filter((c) => !take.has(c.instanceId));
}
