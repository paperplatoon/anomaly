// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// Single source of truth + screen dispatch.
//
// Model (locked in IMPLEMENTATION_PLAN.md):
//   - ONE mutable `state` object.
//   - Systems/primitives mutate it directly, then call render().
//   - Screens are string statuses; render files register a renderer per status.
//     renderScreen() looks the renderer up at call time, so script load order
//     never matters.
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const Status = {
  TITLE: "TITLE",
  LOADOUT: "LOADOUT",
  MAP: "MAP",
  COMBAT: "COMBAT",
  LOOT_REWARD: "LOOT_REWARD",
  TRADER: "TRADER",
  DOCTOR: "DOCTOR",
  MECHANIC: "MECHANIC",
  EVENT: "EVENT",
  EXTRACTION_CONFIRM: "EXTRACTION_CONFIRM",
  DEATH: "DEATH",
  VICTORY: "VICTORY",
  RUN_SUMMARY: "RUN_SUMMARY",
  RELIC_REWARD: "RELIC_REWARD", // picked up a relic (map tile)
  CARD_GALLERY: "CARD_GALLERY", // dev-only: view/tune every card
  ENEMY_GALLERY: "ENEMY_GALLERY", // dev-only: bestiary
  EVENT_GALLERY: "EVENT_GALLERY", // dev-only: every event
};

// Max cards in hand. Capped so the hand is always a single row at the bottom.
const MAX_HAND_SIZE = 8;

// Radiation cap. Gains clamp here and every readout shows "X/40".
const RAD_MAX = 40;

// status string -> render function. Populated by render/*.js via registerRenderer.
const renderers = {};
function registerRenderer(status, fn) {
  renderers[status] = fn;
}

// ----- initial state --------------------------------------------------------

function createInitialPlayer() {
  return {
    maxHp: 70,
    hp: 70,
    radiation: 0,
    energy: 0,
    maxEnergy: 3,
    block: 0,
    strength: 0,
    dexterity: 0,
    // persistent equipment stats (set by equipped guns/shields — future
    // inventory). Read by atk()/blk(); always-active, like Strength/Dex.
    shootBonus: 0,
    blockBonus: 0,
    knifeBonus: 0,
    bonusDraw: 0, // global "+N cards drawn" from events/mods
    // relic stats — set by relic onAcquire(), read by central combat logic. They
    // stack across relics (e.g. energyPerTurn += 1 from Overclocked Battery AND
    // from Ritual Talisman). Reset each run via createInitialState.
    energyPerTurn: 0, // extra energy every turn
    turn1Energy: 0, // one-time energy adjust on turn 1
    autoBlock: 0, // persistent Auto-Block source (relic/equipment); combat mods add more
    extraDrawPerTurn: 0, // extra cards drawn each turn
    radReduction: 0, // reduces positive radiation gains
    postCombatHeal: 0, // HP healed after each combat
    postCombatRadRemove: 0, // radiation removed after each combat
    postCombatRadGain: 0, // radiation gained after each combat
    postCombatHpLoss: 0, // HP lost after each combat

    deck: [],
    drawPile: [],
    hand: [],
    discardPile: [],
    exhaustPile: [],
    credits: 5, // starting pocket money (economy is small-denomination: sells 1/4/10)
    removesBought: 0, // trader card-removals this run (fee escalates: 8, 12, 16…)
    // Relics: `artifacts` = everything owned; `equippedArtifacts` = the (≤5)
    // active ones. Only equipped relics fire hooks / contribute stats
    // (recomputeRelicStats). Swap them on the equipment screen.
    artifacts: [],
    equippedArtifacts: [],
    equipmentMods: [],
    // Equipment inventory. `equipped` bonuses are added on top of the *Bonus
    // stats by atk()/blk() (via equippedBonus); `stash` holds unequipped items.
    equipped: { weapon: null, armor: null, knife: null },
    stash: [],
    preservedItems: [],
  };
}

function createInitialState() {
  return {
    status: Status.TITLE,
    runNumber: 1,
    player: createInitialPlayer(),
    map: {
      width: 12,
      height: 12,
      tiles: {}, // keyed "x_y"
      playerX: 6,
      playerY: 11,
      landmarks: [],
    },
    currentCombat: null,
    currentTile: null,
    currentTrader: null,
    currentEvent: null,
    runResult: null,
    // post-combat rewards: [{ kind: pick|random|salvage, label, cards, done }]
    pendingRewards: [],
    activeRewardIndex: null, // reward currently open on its decision screen
    pendingRewardCredits: 0,
    pendingArtifact: null,
    beaconExtract: false,
    meta: {
      preservedItems: [],
      discoveredLandmarks: {},
      bankedCredits: 0,
      bestRunValue: 0,
    },
  };
}

// The one global. Mutated in place; never reassigned wholesale.
let state = createInitialState();

// ----- dispatch -------------------------------------------------------------

function renderScreen(s) {
  if (typeof hideCardTooltips === "function") hideCardTooltips(); // drop stale hover tooltips
  if (typeof hidePileOverlay === "function") hidePileOverlay(); // drop stale pile popup
  const app = clearApp();
  const fn = renderers[s.status];
  if (!fn) {
    app.append(
      el("div", { class: "error", text: `No renderer for status: ${s.status}` })
    );
    return;
  }
  fn(s);
}

// Standard re-render entry point. After any state mutation, call render().
function render() {
  renderScreen(state);
}

// Convenience: change screen and re-render.
function goToStatus(newStatus) {
  state.status = newStatus;
  render();
}
