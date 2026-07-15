// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// Boot + run lifecycle glue. Loaded last so everything it calls exists.
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

// ===== TUNING KNOBS (play with these) =====================================

// Zone (map) size. START is bottom-center, BOSS (Final Lab) top-center; the map
// splits into an easy bottom half and a medium top half. Applied below.
const ZONE = {
  width: 8,
  height: 8,
};

// Post-combat rewards. `pickCount` = cards offered on the "Pick a reward"
// screen (take 1 or skip for a credit). `rarityWeight` controls how often each
// rarity shows in reward rolls. Bonus-reward odds (random card / Valuable
// Salvage) live in REWARD_TIER_CHANCE in rewardSystem.js (easy 1/5, medium 1/3,
// elite+boss guaranteed).
const LOOT_CONFIG = {
  pickCount: 3,
  rarityWeight: { common: 6, uncommon: 3, rare: 1 },
};

configureZone(ZONE.width, ZONE.height);

// ==========================================================================

// Start a brand-new expedition. Restores persistent meta, builds the starting
// deck, and offers a carried-over item (loadout) if one was preserved.
function startNewRun() {
  const meta = loadMeta();
  state = createInitialState();
  state.meta = meta;
  state.player.deck = buildStartingDeck();

  if (meta.preservedItems && meta.preservedItems.length) {
    state.status = Status.LOADOUT;
    render();
  } else {
    beginExpedition();
  }
}

// Generate the Zone map and drop the player in.
function beginExpedition() {
  state.map = generateMap();
  revealAround(START_X, START_Y, 2);
  state.status = Status.MAP;
  render();
}

// Loadout choice: index into meta.preservedItems, or -1 to skip.
function chooseLoadout(index) {
  if (index >= 0 && state.meta.preservedItems[index]) {
    const item = state.meta.preservedItems[index];
    const card = makeCard(item.templateId);
    if (item.upgraded) upgradeCard(card);
    state.player.deck.push(card);
    state.meta.preservedItems.splice(index, 1); // consumed into the run
    saveMeta();
  }
  beginExpedition();
}

// Kick everything off (title screen).
render();
