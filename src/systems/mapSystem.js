// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// Overworld map: generation, fog of war, movement, tile resolution.
//
// Movement is 4-directional and free, so on an obstacle-free grid the minimum
// number of moves between two tiles == their Manhattan distance. That makes the
// reachability guarantees (§8.6) simple distance checks.
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

// Zone dimensions. Tunable at runtime via ZONE in main.js -> configureZone().
// START is bottom-center, BOSS (Final Lab) top-center; MAP_MID_Y splits the
// easy (bottom) / medium (top) halves. All derived so only width/height matter.
let MAP_W = 12;
let MAP_H = 12;
let START_X = Math.floor(MAP_W / 2);
let START_Y = MAP_H - 1;
let BOSS_X = Math.floor(MAP_W / 2);
let BOSS_Y = 0;
let MAP_MID_Y = Math.floor(MAP_H / 2);

function configureZone(width, height) {
  MAP_W = Math.max(4, width);
  MAP_H = Math.max(4, height);
  START_X = Math.floor(MAP_W / 2);
  START_Y = MAP_H - 1;
  BOSS_X = Math.floor(MAP_W / 2);
  BOSS_Y = 0;
  MAP_MID_Y = Math.floor(MAP_H / 2);
}

function keyFor(x, y) {
  return `${x}_${y}`;
}
function manhattan(ax, ay, bx, by) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

// ----- generation --------------------------------------------------------

function buildMapAttempt() {
  const tiles = {};
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      tiles[keyFor(x, y)] = {
        id: keyFor(x, y), x, y,
        type: "empty",
        landmarkId: null,
        theme: null,
        label: null,
        difficulty: 1,
        revealed: false,
        visited: false,
        visibleFromStart: false,
        resolved: false,
      };
    }
  }

  const start = tiles[keyFor(START_X, START_Y)];
  start.visited = true;

  const boss = tiles[keyFor(BOSS_X, BOSS_Y)];
  Object.assign(boss, {
    type: "boss", landmarkId: "finalLaboratory", label: "Final Laboratory",
    theme: "boss", difficulty: 3, visibleFromStart: true, revealed: true,
  });

  // place the 3 non-boss landmarks, spaced apart and away from start/boss.
  // Spacing scales with map size so small Zones stay placeable.
  const spacing = Math.max(2, Math.floor(Math.min(MAP_W, MAP_H) / 3));
  const placed = [];
  let guard = 0;
  for (const lm of landmarks.filter((l) => !l.isBoss)) {
    let cell = null;
    while (guard++ < 800) {
      const x = randInt(1, MAP_W - 2);
      const y = randInt(1, MAP_H - 2);
      const t = tiles[keyFor(x, y)];
      if (t.type !== "empty") continue;
      if (manhattan(x, y, START_X, START_Y) < spacing) continue;
      if (manhattan(x, y, BOSS_X, BOSS_Y) < Math.max(2, spacing - 1)) continue;
      if (placed.some((p) => manhattan(x, y, p.x, p.y) < spacing)) continue;
      cell = t;
      break;
    }
    if (!cell) return null;
    Object.assign(cell, {
      type: "landmark", landmarkId: lm.id, label: lm.name, theme: lm.theme,
      difficulty: 2, visibleFromStart: true, revealed: true,
    });
    placed.push(cell);
  }

  // theme of a cell = nearest landmark within distance 3, else generic
  function themeOf(cell) {
    let best = null;
    let bd = 99;
    for (const lm of placed) {
      const d = manhattan(cell.x, cell.y, lm.x, lm.y);
      if (d < bd) { bd = d; best = lm; }
    }
    return best && bd <= 3 ? best.theme : "generic";
  }

  const reserved = new Set([start.id, boss.id, ...placed.map((c) => c.id)]);
  let free = shuffle(Object.values(tiles).filter((t) => !reserved.has(t.id)));

  function take(pred) {
    for (let i = 0; i < free.length; i++) {
      if (pred(free[i])) return free.splice(i, 1)[0];
    }
    return null;
  }
  function assign(cell, type) {
    cell.type = type;
    if (type === "combat" || type === "elite") cell.theme = themeOf(cell);
  }

  // guarantee an extraction near the start so the player can always bank + bail
  const nearExit = take((c) => manhattan(c.x, c.y, START_X, START_Y) <= Math.max(4, spacing));
  if (!nearExit) return null;
  assign(nearExit, "extraction");

  // 2 relic tiles, spaced away from the start (the landmark bosses grant the
  // other relics, keeping the run at ~5 relics).
  let relics = 2;
  while (relics > 0) {
    const c = take((cc) => manhattan(cc.x, cc.y, START_X, START_Y) >= spacing);
    if (!c) break;
    assign(c, "relic");
    relics--;
  }
  if (relics > 0) return null;

  // 2 traders, one per half (bottom = easy, top = medium) so a shop is reachable
  // both early and late in the climb.
  const traderBottom = take((c) => c.y >= MAP_MID_Y && manhattan(c.x, c.y, START_X, START_Y) >= Math.max(2, spacing - 1));
  const traderTop = take((c) => c.y < MAP_MID_Y);
  if (!traderBottom || !traderTop) return null;
  assign(traderBottom, "trader");
  assign(traderTop, "trader");

  // Fill EVERY remaining cell by weighted roll so combat is unavoidable:
  //   75% combat · 10% event · 15% blank.
  // Combats near a landmark can spawn as (tougher, themed) elites.
  free.forEach((c) => {
    const r = Math.random();
    if (r < 0.75) {
      const elite = themeOf(c) !== "generic" && Math.random() < 0.25;
      assign(c, elite ? "elite" : "combat");
    } else if (r < 0.85) {
      assign(c, "event");
    }
    // else: leave blank (empty)
  });

  return {
    width: MAP_W, height: MAP_H, tiles,
    playerX: START_X, playerY: START_Y,
    landmarks: placed.map((c) => ({ id: c.landmarkId, x: c.x, y: c.y })),
  };
}

function validateMap(map) {
  const cells = Object.values(map.tiles);
  const traders = cells.filter((c) => c.type === "trader").length;
  const relics = cells.filter((c) => c.type === "relic").length;
  const exitOk = cells.some((c) => c.type === "extraction");
  return traders >= 2 && relics >= 2 && exitOk;
}

function generateMap() {
  for (let i = 0; i < 80; i++) {
    const m = buildMapAttempt();
    if (m && validateMap(m)) return m;
  }
  return buildMapAttempt(); // best effort
}

// ----- fog + movement ----------------------------------------------------

function revealAround(x, y, r = 2) {
  for (const k in state.map.tiles) {
    const c = state.map.tiles[k];
    if (manhattan(c.x, c.y, x, y) <= r) c.revealed = true;
  }
}

function playerTile() {
  return state.map.tiles[keyFor(state.map.playerX, state.map.playerY)];
}

function isAdjacentToPlayer(tile) {
  return manhattan(tile.x, tile.y, state.map.playerX, state.map.playerY) === 1;
}

function movePlayerTo(tileId) {
  const tile = state.map.tiles[tileId];
  if (!tile || !isAdjacentToPlayer(tile)) return;
  state.map.playerX = tile.x;
  state.map.playerY = tile.y;
  tile.visited = true;
  revealAround(tile.x, tile.y, 2);
  resolveTile(tile);
}

function showMap() {
  state.status = Status.MAP;
  render();
}

// ----- tile resolution ---------------------------------------------------

function resolveTile(tile) {
  state.currentTile = tile;
  switch (tile.type) {
    case "combat":
    case "elite":
    case "landmark":
    case "boss": {
      if (tile.resolved) return showMap();
      const enc = getEncounterForTile(tile);
      const isLandmark = tile.type === "landmark";
      const isElite = tile.type === "elite" || isLandmark;
      startCombat(enc, { isBoss: tile.type === "boss", isElite, isLandmark, tile });
      return;
    }
    case "loot":
      if (tile.resolved) return showMap();
      return openLootCache(tile);
    case "relic":
      if (tile.resolved) return showMap();
      return openRelicTile(tile);
    case "trader":
      if (tile.resolved) return showMap();
      state.currentTrader = { offers: generateTraderOffers(), removeMode: false };
      state.status = Status.TRADER;
      return render();
    case "doctor":
      if (tile.resolved) return showMap();
      state.status = Status.DOCTOR;
      return render();
    case "mechanic":
      if (tile.resolved) return showMap();
      state.status = Status.MECHANIC;
      return render();
    case "extraction":
      state.status = Status.EXTRACTION_CONFIRM;
      return render();
    case "event":
      if (tile.resolved) return showMap();
      return openEvent(tile);
    default:
      return showMap();
  }
}

// ----- encounter selection (basic; tile-matching refined in Chunk 15) ----

// The map divides in half: bottom (y >= MAP_MID_Y) spawns Easy enemies, top
// spawns Medium. A bright line marks the boundary. (MAP_MID_Y is set by
// configureZone at the top of this file.)

// Easy encounters (bottom half).
const EASY_POOL = [
  ["vampireBat"],
  ["nettlePlant"],
  ["rat", "rat", "rat"],
  ["madTurtle"],
  ["irradiatedFox"],
  ["giantLeech"],
  ["fungalGrowth", "fungalGrowth"],
  ["parasiticFern"],
];

// Medium encounters (top half; elite tiles also draw from here).
const MEDIUM_POOL = [
  ["sporePlant"],
  ["poisonousVines"],
  ["faunaMonstrosity"],
  ["madTurtle", "madTurtle"],
  ["nettlePlant", "nettlePlant"],
  ["fungalColony", "fungalColony", "fungalColony"],
  ["irradiatedWolf"],
];

// Scattered landmarks host a random boss (Core Thing is the Final Lab only).
const LANDMARK_BOSSES = [["giantCrow"], ["millipede"]];

function pick(pool) {
  return pool[randInt(0, pool.length - 1)];
}

function getEncounterForTile(tile) {
  if (tile.type === "boss") return ["coreThing"]; // Final Laboratory
  if (tile.type === "landmark") return pick(LANDMARK_BOSSES);
  if (tile.type === "elite") return pick(MEDIUM_POOL);
  // combat: difficulty by map half
  return pick(tile.y >= MAP_MID_Y ? EASY_POOL : MEDIUM_POOL);
}

// ----- loot cache + event ------------------------------------------------

const CACHE_LOOT_POOL = [
  "lightMutantPelt", "hunkerDown", "antiRadInjection", "swordplay", "irradiatedBullet",
  "coverFire", "turretWall", "treatedShield", "packSorter", "meditate",
];

function openLootCache(tile) {
  const cards = [];
  const seen = new Set();
  while (cards.length < 3 && seen.size < CACHE_LOOT_POOL.length) {
    const id = CACHE_LOOT_POOL[randInt(0, CACHE_LOOT_POOL.length - 1)];
    if (seen.has(id)) continue;
    seen.add(id);
    cards.push(makeCard(id));
  }
  state.pendingRewards = [{ kind: "pick", label: "Pick a reward", cards, done: false }];
  state.pendingRewardCredits = 0;
  state.activeRewardIndex = null;
  state.status = Status.LOOT_REWARD;
  render();
}

// Relic tile: grant a random unowned relic and show the reward screen. If the
// player somehow owns every relic, fall back to the map.
function openRelicTile(tile) {
  const relic = typeof grantRandomArtifact === "function" ? grantRandomArtifact(state) : null;
  if (!relic) return showMap();
  state.pendingArtifact = relic;
  state.status = Status.RELIC_REWARD;
  render();
}

function openEvent(tile) {
  const def = pickWeightedEvent();
  const ev = { def, selected: [], done: false, result: null };
  if (typeof def.onOpen === "function") def.onOpen(state, ev);
  // "auto" events apply immediately and go straight to their result line.
  if (def.kind === "auto") { ev.result = def.apply(state); ev.done = true; }
  state.currentEvent = ev;
  state.status = Status.EVENT;
  render();
}

// ----- returning to the map ----------------------------------------------

// Called by the rewards screen's Continue button (unclaimed rewards are left
// behind) and by the relic screen.
function leaveLoot() {
  state.pendingRewards = [];
  state.activeRewardIndex = null;
  state.pendingRewardCredits = 0;
  state.pendingArtifact = null;
  if (state.currentTile) {
    state.currentTile.resolved = true;
    state.currentTile = null;
  }
  showMap();
}

// One-time services mark their tile resolved when you leave.
function leaveService() {
  if (state.currentTile) {
    state.currentTile.resolved = true;
    state.currentTile = null;
  }
  state.currentTrader = null;
  showMap();
}
