// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// Post-combat rewards. Every victory offers a "Pick a reward" (choose 1 of 3
// cards, or skip for 1 credit). Depending on how tough the fight was, it can
// also drop a "Random reward" (one random card, take or skip) and/or "Salvage
// found" (a Valuable Salvage card, take or skip):
//   easy 1-in-5 · medium 1-in-3 · elite/landmark/boss guaranteed  (each rolled
//   independently), so a lucky fight can add up to 3 cards to the deck.
// Rewards stage in state.pendingRewards; the LOOT_REWARD screen resolves them.
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

function lootConfig() {
  return typeof LOOT_CONFIG !== "undefined"
    ? LOOT_CONFIG
    : { pickCount: 3, rarityWeight: { common: 6, uncommon: 3, rare: 1 } };
}

// Every card whose rarity has a loot weight can drop — excludes starters and
// "special" cards (enemy-inflicted, Valuable Salvage) automatically.
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

// N distinct-template random cards for the pick screen.
function rollPickCards(n) {
  const cards = [];
  const seen = new Set();
  let guard = 0;
  while (cards.length < n && guard++ < 60) {
    const c = randomLootCard();
    if (seen.has(c.templateId)) continue;
    seen.add(c.templateId);
    cards.push(c);
  }
  return cards;
}

// How tough was this fight? Drives the bonus-reward odds.
function encounterRewardTier(combat) {
  if (combat.isBoss || combat.isLandmark || combat.isElite) return "hard";
  const foes = combat.rewardContext.killedEnemies.concat(combat.rewardContext.capturedEnemies);
  if (foes.some((e) => e.difficulty === "medium" || e.difficulty === "boss")) return "medium";
  return "easy";
}
const REWARD_TIER_CHANCE = { easy: 1 / 5, medium: 1 / 3, hard: 1 };

// Build the reward list + flat credits for the just-finished combat.
function generateCombatRewards(s) {
  const combat = s.currentCombat;
  const chance = REWARD_TIER_CHANCE[encounterRewardTier(combat)];

  const rewards = [
    { kind: "pick", label: "Pick a reward", cards: rollPickCards(lootConfig().pickCount || 3), done: false },
  ];
  if (Math.random() < chance) {
    rewards.push({ kind: "random", label: "Random reward", cards: [randomLootCard()], done: false });
  }
  if (Math.random() < chance) {
    rewards.push({ kind: "salvage", label: "Salvage found", cards: [makeCard("valuableSalvage")], done: false });
  }

  let credits = 0;
  combat.rewardContext.killedEnemies.forEach((e) => { if (e.creditsOnKill) credits += e.creditsOnKill; });

  return { rewards, credits };
}

// ----- resolving rewards (LOOT_REWARD screen actions) ----------------------

function openReward(index) {
  const r = state.pendingRewards[index];
  if (!r || r.done) return;
  state.activeRewardIndex = index;
  render();
}

// Back out of a decision screen without consuming the reward.
function closeReward() {
  state.activeRewardIndex = null;
  render();
}

// Take a card from the active reward into the deck (consumes the reward).
function chooseRewardCard(instanceId) {
  const r = state.pendingRewards[state.activeRewardIndex];
  if (!r || r.done) return;
  const card = r.cards.find((c) => c.instanceId === instanceId);
  if (!card) return;
  state.player.deck.push(card);
  r.done = true;
  r.taken = card;
  state.activeRewardIndex = null;
  render();
}

// Skip the active reward. Skipping the pick pays 1 credit; the bonus rewards
// pay nothing.
function skipReward() {
  const r = state.pendingRewards[state.activeRewardIndex];
  if (!r || r.done) return;
  if (r.kind === "pick") gainCredits(state, 1);
  r.done = true;
  r.skipped = true;
  state.activeRewardIndex = null;
  render();
}
