// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// Enemy templates + makeEnemy() + intent selection. Imported from Enemies.xlsx.
//
// difficulty: "easy" (bottom map half) | "medium" (top half) | "boss" (landmarks).
// AI: one declarative selector (see rollIntent below). Per-move fields — weight,
// noConsecutive, cooldown, maxUses, when(s,e), priority(s,e), dynamicDamage(s,e) —
// plus firstMoveOpens (turn 1 = moves[0]) and the baseline rule that an enemy
// always attacks the turn after a non-attack move. No enemy uses intentFn anymore.
//
// move fields: type attack|block|buff|debuff|summon|healAllies|buffAllies;
//   damage, hits, radiation (once after attack), radPerHit (per damaging hit),
//   healSelf + healRamp (ramping self-heal), strength/aim/blockGain, summon,
//   amount + allyTag (group heal/buff), addsCard {templateId,count}, selfDamage,
//   strengthIfDamaged.
// passives: halveFirstHit, radiationOnHit, strengthOnLootPlay, eatsFirstLoot,
//   attackPenaltyOnHit, startBlock, onDefeat(s).
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const enemyTemplates = {
  // ================= EASY (first / bottom map half) =================
  vampireBat: {
    templateId: "vampireBat", name: "Vampire Bat", type: "beast", difficulty: "easy",
    maxHp: 40, tags: ["beast"], firstMoveOpens: true,
    moves: [
      { name: "Drain Bite", type: "attack", damage: 6, strengthIfDamaged: 2, weight: 2 },
      { name: "Screech", type: "buff", strength: 3, noConsecutive: true, cooldown: 2 },
    ],
    lootTable: [
      { templateId: "lightMutantPelt", chance: 0.6 },
      { templateId: "antiRadInjection", chance: 0.5 },
      { templateId: "crackedFang", chance: 0.4 },
    ],
  },
  nettlePlant: {
    templateId: "nettlePlant", name: "Nettle Plant", type: "plant", difficulty: "easy",
    maxHp: 25, tags: ["plant"],
    moves: [{ name: "Shed Nettles", type: "debuff", addsCard: { templateId: "nettle", count: 1 } }],
    lootTable: [
      { templateId: "antiRadInjection", chance: 0.5 },
      { templateId: "treatedShield", chance: 0.4 },
      { templateId: "galvanizer", chance: 0.25 },
    ],
  },
  rat: {
    templateId: "rat", name: "Rat", type: "beast", difficulty: "easy",
    maxHp: 9, tags: ["beast", "swarm"],
    moves: [
      { name: "Bite", type: "attack", damage: 6, weight: 2 },
      // stop "summoning" once the field is full (the summon would fizzle)
      { name: "Multiply", type: "summon", summon: "rat", cooldown: 1,
        when: (s) => !s.currentCombat || s.currentCombat.enemies.length < ENEMY_CAP },
    ],
    lootTable: [
      { templateId: "antiRadInjection", chance: 0.4 },
      { templateId: "lightMutantPelt", chance: 0.2 },
    ],
  },
  madTurtle: {
    templateId: "madTurtle", name: "Mad Turtle", type: "beast", difficulty: "easy",
    maxHp: 30, halveFirstHit: true, tags: ["beast"], firstMoveOpens: true,
    moves: [
      { name: "Shell Bash", type: "attack", damage: 9 },
      { name: "Rage", type: "buff", strength: 3, noConsecutive: true, maxUses: 2 },
    ],
    lootTable: [
      { templateId: "scrapArmor", chance: 0.5 },
      { templateId: "shieldEnergizer", chance: 0.4 },
      { templateId: "energyWall", chance: 0.25 },
    ],
  },
  irradiatedFox: {
    templateId: "irradiatedFox", name: "Irradiated Fox", type: "beast", difficulty: "easy",
    maxHp: 25, radiationOnHit: 1, tags: ["beast", "radiation"], firstMoveOpens: true,
    moves: [
      { name: "Bite", type: "attack", damage: 7, weight: 2 },
      { name: "Savage", type: "attack", damage: 11 },
    ],
    lootTable: [
      { templateId: "irradiatedMagazine", chance: 0.4 },
      { templateId: "treatedShield", chance: 0.4 },
      { templateId: "crackedFang", chance: 0.3 },
    ],
  },
  giantLeech: {
    templateId: "giantLeech", name: "Giant Leech", type: "beast", difficulty: "easy",
    maxHp: 30, tags: ["beast"],
    moves: [
      // healing at full HP is wasted — bite instead
      { name: "Drain", type: "attack", damage: 7, healSelf: 2, when: (s, e) => e.hp < e.maxHp },
      { name: "Bite", type: "attack", damage: 11 },
    ],
    lootTable: [
      { templateId: "antiRadInjection", chance: 0.5 },
      { templateId: "thickSkin", chance: 0.3 },
      { templateId: "healingTech", chance: 0.1 },
    ],
  },
  fungalGrowth: {
    templateId: "fungalGrowth", name: "Fungal Growth", type: "plant", difficulty: "easy",
    maxHp: 17, tags: ["plant", "fungal"],
    moves: [
      { name: "Spew", type: "attack", damage: 7 },
      // heal only when a fungal ally is actually hurt
      { name: "Regrow", type: "healAllies", amount: 4, allyTag: "fungal", noConsecutive: true,
        when: (s) => !!s.currentCombat && s.currentCombat.enemies.some(
          (e) => e.hp > 0 && e.hp < e.maxHp && e.tags && e.tags.includes("fungal")) },
    ],
    lootTable: [
      { templateId: "treatedShield", chance: 0.4 },
      { templateId: "antiRadInjection", chance: 0.3 },
    ],
  },
  parasiticFern: {
    templateId: "parasiticFern", name: "Parasitic Fern", type: "plant", difficulty: "easy",
    maxHp: 35, tags: ["plant"],
    moves: [
      // ALWAYS reseeds while the player's deck holds fewer than 2 Quest spores
      // (priority beats every other rule); otherwise it can only lash.
      { name: "Seed", type: "debuff", addsCard: { templateId: "questingSpore", count: 4 },
        when: (s) => questSporeCount(s) < 2, priority: (s) => questSporeCount(s) < 2 },
      { name: "Questing Lash", type: "attack", dynamicDamage: (s) => 4 * questSporeCount(s) },
    ],
    lootTable: [
      { templateId: "packSorter", chance: 0.4 },
      { templateId: "galvanizer", chance: 0.3 },
      { templateId: "deradiatingShield", chance: 0.3 },
    ],
  },

  // ================= MEDIUM (second / top map half) =================
  sporePlant: {
    templateId: "sporePlant", name: "Irradiated Spore Plant", type: "plant", difficulty: "medium",
    maxHp: 55, tags: ["plant", "radiation"], firstMoveOpens: true,
    moves: [
      { name: "Spore Bloom", type: "debuff", radiation: 8, maxUses: 1,
        addsCard: { templateId: "antiRadSpore", count: 5 } },
      { name: "Toxic Lash", type: "attack",
        dynamicDamage: (s) => 7 + 2 * ((s.currentCombat && s.currentCombat.sporePlayed) || 0) },
    ],
    lootTable: [
      { templateId: "deradiatingShield", chance: 0.4 },
      { templateId: "galvanizer", chance: 0.35 },
      { templateId: "learningShield", chance: 0.3 },
    ],
  },
  poisonousVines: {
    templateId: "poisonousVines", name: "Poisonous Vines", type: "plant", difficulty: "medium",
    maxHp: 60, tags: ["plant", "radiation"],
    onDefeat: (s) => { s.player.knifeBonus += 2; },
    moves: [
      { name: "Lash", type: "attack", damage: 10, radiation: 1 },
      { name: "Thorn Volley", type: "attack", damage: 4, hits: 3, radPerHit: 1 },
    ],
    lootTable: [
      { templateId: "thickSkin", chance: 0.4 },
      { templateId: "learningShield", chance: 0.35 },
      { templateId: "deradiatingShield", chance: 0.3 },
    ],
  },
  faunaMonstrosity: {
    templateId: "faunaMonstrosity", name: "Fauna Monstrosity", type: "beast", difficulty: "medium",
    maxHp: 60, tags: ["beast"],
    moves: [
      // can't flood the deck with bulbs every single turn
      { name: "Maul", type: "attack", damage: 11, cooldown: 1, addsCard: { templateId: "nectarBulb", count: 2 } },
      { name: "Crush", type: "attack", damage: 14 },
    ],
    lootTable: [
      { templateId: "energyWall", chance: 0.4 },
      { templateId: "meditate", chance: 0.35 },
      { templateId: "counterplate", chance: 0.3 },
    ],
  },
  fungalColony: {
    templateId: "fungalColony", name: "Fungal Colony", type: "plant", difficulty: "medium",
    maxHp: 22, tags: ["plant", "fungal"],
    moves: [
      { name: "Spew", type: "attack", damage: 8 },
      // a lone colony just attacks; buffing needs a living fungal pack
      { name: "Bloom", type: "buffAllies", strength: 3, allyTag: "fungal", noConsecutive: true,
        when: (s) => !!s.currentCombat && s.currentCombat.enemies.filter(
          (e) => e.hp > 0 && e.tags && e.tags.includes("fungal")).length >= 2 },
    ],
    lootTable: [
      { templateId: "galvanizer", chance: 0.4 },
      { templateId: "treatedShield", chance: 0.3 },
    ],
  },
  irradiatedWolf: {
    templateId: "irradiatedWolf", name: "Irradiated Wolf", type: "beast", difficulty: "medium",
    maxHp: 45, radiationOnHit: 1, tags: ["beast", "radiation"],
    moves: [
      { name: "Bite", type: "attack", damage: 7, radiation: 1 },
      { name: "Maul", type: "attack", damage: 4, radiation: 2 },
    ],
    lootTable: [
      { templateId: "irradiatedMagazine", chance: 0.4 },
      { templateId: "crackedFang", chance: 0.3 },
      { templateId: "limbRemover", chance: 0.3 },
    ],
  },

  // ================= BOSS (scattered landmarks) =================
  giantCrow: {
    templateId: "giantCrow", name: "Giant Crow", type: "beast", difficulty: "boss",
    maxHp: 110, tags: ["beast", "boss"], strengthOnLootPlay: 1, eatsFirstLoot: true,
    moves: [
      { name: "Talons", type: "attack", damage: 5, hits: 3, weight: 2 },
      { name: "Dive", type: "attack", damage: 21 },
    ],
    lootTable: [
      { templateId: "microNuke", chance: 0.4 },
      { templateId: "reactorVent", chance: 0.4 },
      { templateId: "healingTech", chance: 0.3 },
    ],
  },
  millipede: {
    templateId: "millipede", name: "Humongous Millipede", type: "mutant", difficulty: "boss",
    maxHp: 120, tags: ["mutant", "boss"], attackPenaltyOnHit: 1,
    moves: [
      { name: "Crush", type: "attack", damage: 24 },
      { name: "Skitter", type: "attack", damage: 11, hits: 3 },
    ],
    lootTable: [
      { templateId: "blastRound", chance: 0.4 },
      { templateId: "scrapCannon", chance: 0.4 },
      { templateId: "healingTech", chance: 0.3 },
    ],
  },

  // ================= FINAL BOSS (Final Laboratory; wins the run) =================
  coreThing: {
    templateId: "coreThing", name: "The Core Thing", type: "anomaly", difficulty: "boss",
    maxHp: 180, tags: ["boss", "anomaly"],
    // Two phases via `when` gates (above / below half HP). Declarative moves put
    // it under the same AI rules as everyone else — it can no longer chain
    // Reality Shield / Radiation Flood turtling. (makeEnemy's dmgMult scaling
    // now applies to these numbers automatically.)
    moves: [
      { name: "Anomalous Strike", type: "attack", damage: 14, weight: 2, when: (s, e) => e.hp > e.maxHp / 2 },
      { name: "Warp Slam", type: "attack", damage: 10, hits: 2, when: (s, e) => e.hp > e.maxHp / 2 },
      { name: "Irradiate", type: "debuff", radiation: 1, noConsecutive: true, when: (s, e) => e.hp > e.maxHp / 2 },
      { name: "Double Strike", type: "attack", damage: 10, hits: 2, weight: 2, when: (s, e) => e.hp <= e.maxHp / 2 },
      { name: "Reality Shield", type: "block", block: 20, noConsecutive: true, cooldown: 2, when: (s, e) => e.hp <= e.maxHp / 2 },
      { name: "Radiation Flood", type: "debuff", radiation: 2, noConsecutive: true, when: (s, e) => e.hp <= e.maxHp / 2 },
    ],
    lootTable: [],
  },
};

// makeEnemy(id, { hpMult, dmgMult }) — scaling applied at combat entry.
function makeEnemy(templateId, scale = {}) {
  const t = enemyTemplates[templateId];
  if (!t) throw new Error(`Unknown enemy template: ${templateId}`);
  const hpMult = scale.hpMult ?? 1;
  const dmgMult = scale.dmgMult ?? 1;
  const maxHp = Math.max(1, Math.round(t.maxHp * hpMult));
  const moves = (t.moves || []).map((m) =>
    m.damage != null ? { ...m, damage: Math.max(1, Math.round(m.damage * dmgMult)) } : { ...m }
  );
  return {
    ...t,
    moves,
    instanceId: nextId("enemy"),
    hp: maxHp,
    maxHp,
    dmgMult,
    block: t.startBlock || 0,
    strength: 0,
    nextAttackBonus: 0,
    stunned: 0,
    marked: false,
    intent: null,
    captured: false,
    _firstHitDone: false,
    _turnsActed: 0,
    _lastMoveType: null, // last move it performed (drives the always-attack-after-support rule)
    _lastMoveName: null, // for noConsecutive
    _moveUses: {}, // per-move use counts (maxUses)
    _cooldowns: {}, // per-move remaining cooldown turns
  };
}

// Quest spores currently in the player's DECK (they're single-use, so playing
// one removes it). Drives the Parasitic Fern's reseed rule + lash damage.
function questSporeCount(s) {
  return s.player.deck.filter((c) => c.tags && c.tags.includes("quest")).length;
}

// ----- declarative AI selector ---------------------------------------------
// Every enemy uses ONE selector driven by optional per-move fields:
//   weight         — selection weight (default 1)
//   noConsecutive  — never pick twice in a row
//   cooldown: N    — unusable for the N turns after use
//   maxUses: N     — usable at most N times per combat
//   when(s, e)     — gate: only selectable while true
//   priority(s, e) — FORCED this turn when true (first declared match wins;
//                    beats every other rule — e.g. the Fern's reseed)
//   dynamicDamage(s, e) — live-computed attack number (kept fresh by
//                    refreshIntent so the shown intent tracks player actions)
// Baseline sanity rule: after any non-attack move the enemy attacks next turn
// (if it has an attack), so support moves can never chain. Fallbacks (any
// attack -> any move -> idle) mean an over-constrained enemy never locks up.

function pickWeightedMove(pool) {
  const total = pool.reduce((a, m) => a + (m.weight || 1), 0);
  let r = Math.random() * total;
  for (const m of pool) {
    r -= m.weight || 1;
    if (r < 0) return m;
  }
  return pool[pool.length - 1];
}

// Resolve dynamic numbers into the committed intent (a copy, so the template
// move is never mutated). Static moves pass through untouched.
function finalizeMove(move, enemy, s) {
  if (move && typeof move.dynamicDamage === "function") {
    return { ...move, damage: Math.max(0, Math.round(move.dynamicDamage(s, enemy))) };
  }
  return move;
}

function rollIntent(enemy, s = state) {
  if (enemy.intentFn) return enemy.intentFn(enemy); // legacy escape hatch (roster no longer uses it)
  const moves = enemy.moves || [];
  if (!moves.length) return { name: "Idle", type: "idle" };
  if (enemy.firstMoveOpens && (enemy._turnsActed || 0) === 0) return finalizeMove(moves[0], enemy, s);

  const uses = enemy._moveUses || {};
  const cds = enemy._cooldowns || {};
  const usable = moves.filter(
    (m) =>
      !(cds[m.name] > 0) &&
      !(m.noConsecutive && enemy._lastMoveName === m.name) &&
      !(m.maxUses != null && (uses[m.name] || 0) >= m.maxUses) &&
      (!m.when || m.when(s, enemy))
  );

  const forced = usable.find((m) => m.priority && m.priority(s, enemy));
  if (forced) return finalizeMove(forced, enemy, s);

  let pool = usable;
  const usableAttacks = usable.filter((m) => m.type === "attack");
  if (usableAttacks.length && enemy._lastMoveType && enemy._lastMoveType !== "attack") {
    pool = usableAttacks; // always attack after a support move
  }
  if (!pool.length) pool = moves.filter((m) => m.type === "attack");
  if (!pool.length) pool = moves;

  return finalizeMove(pickWeightedMove(pool), enemy, s);
}

// Bookkeeping when an enemy actually performs a move: cooldowns tick down, the
// used move starts its cooldown, uses / last-move are recorded for the AI rules.
// Called by both combat paths in place of the old inline counters.
function recordEnemyMove(enemy, move) {
  enemy._turnsActed = (enemy._turnsActed || 0) + 1;
  enemy._lastMoveType = move.type;
  enemy._lastMoveName = move.name;
  const cds = enemy._cooldowns || (enemy._cooldowns = {});
  for (const k in cds) cds[k] = Math.max(0, cds[k] - 1);
  if (move.cooldown) cds[move.name] = move.cooldown;
  const uses = enemy._moveUses || (enemy._moveUses = {});
  uses[move.name] = (uses[move.name] || 0) + 1;
}

// Keep a committed intent's dynamic number in sync with current state, so both
// the shown and resolved values stay accurate while the player acts (e.g. the
// Fern's lash weakens as you spend Quest cards). The MOVE itself stays
// committed — honest telegraphing — only its number updates.
function refreshIntent(enemy) {
  if (enemy.hp > 0 && enemy.intent) {
    if (enemy.intentFn) enemy.intent = enemy.intentFn(enemy);
    else if (typeof enemy.intent.dynamicDamage === "function") {
      enemy.intent = finalizeMove(enemy.intent, enemy, state);
    }
  }
  return enemy.intent;
}
