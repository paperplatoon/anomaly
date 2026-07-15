// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// Shared combat primitives. Cards/enemies never poke raw hp/block; they call
// these, so Strength/Dex, block absorption, reshuffle, radiation, combat mods
// (powers), and artifact hooks all apply centrally.
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

// The on-screen combat log was removed (actions are communicated via animation);
// keep the hook as a no-op so primitives don't need editing.
function logMsg() {}

// Convenience: current combat modifier bag (powers write here).
function mods() {
  return state.currentCombat ? state.currentCombat.mods : null;
}

// --- attack / block value (Strength/Dex + tag-based power mods) --------------

// Attack value = base + Strength + shoot bonuses. Shoot bonuses come from BOTH a
// temporary combat buff (mods.shootDamage, set by a skill) and a persistent
// equipment stat (player.shootBonus, from an equipped gun — the STALKER "good
// loot" version of Strength). Both show live in the card's text.
// Attack value = base + Strength + weapon bonuses. A shoot/knife card gets BOTH
// a temporary combat buff (mods.shootDamage / mods.knifeDamage, from a Mutation
// skill) AND a persistent equipment stat (player.shootBonus / player.knifeBonus,
// from equipped gear). Both show live in the card's text.
function atk(s, base, card) {
  let d = base + s.player.strength;
  if (card && card.tags) {
    const m = s.currentCombat && s.currentCombat.mods;
    const eqBonus = typeof equippedBonus === "function" ? equippedBonus : () => 0;
    if (card.tags.includes("shoot")) { if (m) d += m.shootDamage || 0; d += s.player.shootBonus || 0; d += eqBonus(s, "shoot"); }
    if (card.tags.includes("knife")) { if (m) d += m.knifeDamage || 0; d += s.player.knifeBonus || 0; d += eqBonus(s, "knife"); }
  }
  // Millipede: hitting it lowers all your attacks this turn.
  if (s.currentCombat) d -= s.currentCombat.playerAttackPenalty || 0;
  return Math.max(0, d);
}

function blk(s, base, card) {
  let b = base + s.player.dexterity;
  if (card && card.tags && card.tags.includes("shield")) {
    const m = s.currentCombat && s.currentCombat.mods;
    if (m) b += m.shieldBlock || 0;
    b += s.player.blockBonus || 0;
    if (typeof equippedBonus === "function") b += equippedBonus(s, "block");
  }
  return Math.max(0, b);
}

// --- per-combat scaling ("gain X damage this combat") -----------------------
// combatDamage/combatBlock accumulate while a card is played during a fight and
// reset at combat end. dmgOf/blkOf are the display + resolution value (base +
// scaling, run through atk/blk so weapon/Strength bonuses apply).
function dmgBase(c) { return (c.damage || 0) + (c.combatDamage || 0); }
function blkBase(c) { return (c.block || 0) + (c.combatBlock || 0); }
function dmgOf(s, c) { return atk(s, dmgBase(c), c); }
function blkOf(s, c) { return blk(s, blkBase(c), c); }

// Trailing keyword text so every card lists all of its effects. These strings
// are the hover keywords explained by the tooltip system (render/tooltips.js);
// the card renderer styles them (Recharging = dark blue keyword line).
function cardExtras(c) {
  let t = "";
  if (c.refills) t += " Recharging.";
  if (c.consumedOnUse) t += " Single-use.";
  return t;
}

// Total Auto-Block: block granted automatically at the end of every turn. Sums
// the per-combat mod (from cards) and any persistent source (relic/equipment).
function autoBlockValue(s) {
  const combat = s.currentCombat && s.currentCombat.mods ? s.currentCombat.mods.autoBlock || 0 : 0;
  return combat + (s.player.autoBlock || 0);
}

// --- central numeric readers (card property + global buff hook) -------------
// Every numeric card effect goes through one of these so it can be tuned per
// card (base* / an upgrade) OR buffed globally by an event/mod. Draw is the key
// one: because it's applied as a rider (below), ANY card with draw > 0 draws —
// so a buff can give a no-draw card +2 draw.
function effectiveDraw(s, c) {
  const m = mods();
  return Math.max(0, (c.draw || 0) + (m ? m.bonusDraw || 0 : 0) + (s.player.bonusDraw || 0));
}
function effectiveEnergyGain(s, c) {
  return Math.max(0, c.energyGain || 0);
}
function effectiveRad(s, c) {
  return c.rad || 0; // signed: positive gains Radiation, negative removes it
}

// Text helper: " Draw N." when the card draws (reflects buffs), else "".
function drawSuffix(s, c) {
  const n = effectiveDraw(s, c);
  return n > 0 ? ` Draw ${n}.` : "";
}

// --- multi-hit / multi-application ------------------------------------------
// Attacks repeat `hits` times; block cards apply block `blockTimes` times. Each
// repeat re-applies Strength/Dex and gun/shield mods, so per-hit bonuses stack.
// Mods can add extra repeats (bonusHits / bonusBlockTimes) — e.g. an equipped
// gun that fires an extra shot.

function effectiveHits(s, card) {
  const m = mods();
  return Math.max(1, (card.hits || 1) + (m ? m.bonusHits || 0 : 0));
}
function effectiveBlockTimes(s, card) {
  const m = mods();
  return Math.max(1, (card.blockTimes || 1) + (m ? m.bonusBlockTimes || 0 : 0));
}

// Deal `base` damage to one target, effectiveHits times (Strength/mods per hit).
function dealDamageHits(s, enemy, base, card, opts = {}) {
  const n = effectiveHits(s, card);
  for (let i = 0; i < n; i++) dealDamage(s, enemy, base, { card, ...opts });
}
function dealDamageAllHits(s, base, card, opts = {}) {
  const n = effectiveHits(s, card);
  for (let i = 0; i < n; i++) dealDamageAll(s, base, { card, ...opts });
}
function dealDamageRandomHits(s, base, card) {
  const n = effectiveHits(s, card);
  for (let i = 0; i < n; i++) dealDamageRandom(s, base);
}
// Gain `base` block, effectiveBlockTimes times (Dex/shield mods per application).
function gainBlockHits(s, base, card) {
  const n = effectiveBlockTimes(s, card);
  for (let i = 0; i < n; i++) gainBlock(s, base, { card });
}

// Text suffix: " N times" when the repeat count exceeds 1, else "".
function hitsSuffix(s, card) {
  const n = effectiveHits(s, card);
  return n > 1 ? ` ${n} times` : "";
}
function blockTimesSuffix(s, card) {
  const n = effectiveBlockTimes(s, card);
  return n > 1 ? ` ${n} times` : "";
}

// --- damage -----------------------------------------------------------------

function dealDamage(s, enemy, base, opts = {}) {
  if (!enemy || enemy.hp <= 0) return;
  let dmg = atk(s, base, opts.card);

  // Phase Stalker: the first hit it takes each turn is halved (rewards multi-hit).
  if (enemy.halveFirstHit && !enemy._firstHitDone) {
    dmg = Math.ceil(dmg / 2);
    enemy._firstHitDone = true;
  }

  if (!opts.ignoreBlock && enemy.block > 0) {
    const absorbed = Math.min(enemy.block, dmg);
    enemy.block -= absorbed;
    dmg -= absorbed;
  }
  enemy.hp -= dmg;
  logMsg(`You hit ${enemy.name} for ${dmg}.`);
  if (typeof queueAnim === "function") {
    queueAnim({
      kind: "enemyDamage",
      iid: enemy.instanceId,
      amount: dmg,
      hpAfter: enemy.hp,
      maxHp: enemy.maxHp,
      blockAfter: enemy.block,
      fx: currentFx(s, opts.card),
    });
  }

  // On-being-hit reactions (fire once per dealDamage call = per hit).
  if (enemy.strengthOnHit) {
    enemy.strength += enemy.strengthOnHit; // enrage per hit (rewards big single hits)
  }
  if (enemy.thorns) {
    dealSelfDamage(s, enemy.thorns); // reflect per hit (punishes multi-hit)
  }
  if (enemy.radiationOnHit && enemy.hp > 0) {
    gainRadiation(s, enemy.radiationOnHit); // Irradiated Fox: rad per hit (punishes multi-hit)
  }
  if (enemy.attackPenaltyOnHit && s.currentCombat) {
    s.currentCombat.playerAttackPenalty = (s.currentCombat.playerAttackPenalty || 0) + enemy.attackPenaltyOnHit;
  }
}

function dealDamageAll(s, base, opts = {}) {
  s.currentCombat.enemies.forEach((e) => dealDamage(s, e, base, opts));
}

// Damage a random living enemy (Shield Spikes, etc.).
function dealDamageRandom(s, base) {
  const alive = s.currentCombat.enemies.filter((e) => e.hp > 0);
  if (!alive.length) return;
  dealDamage(s, alive[randInt(0, alive.length - 1)], base, { ignoreBlock: true });
}

function dealPlayerDamage(s, base, enemy) {
  let dmg = Math.max(0, base + (enemy ? enemy.strength : 0) + (enemy ? enemy.nextAttackBonus || 0 : 0));
  if (enemy) enemy.nextAttackBonus = 0;
  if (s.player.block > 0) {
    const absorbed = Math.min(s.player.block, dmg);
    s.player.block -= absorbed;
    dmg -= absorbed;
  }
  s.player.hp -= dmg;
  logMsg(`${enemy ? enemy.name : "Enemy"} hits you for ${dmg}.`);
  if (typeof queueAnim === "function") {
    // `from` lets the animation lunge the attacker so you can see WHO hit you
    queueAnim({ kind: "playerDamage", amount: dmg, from: enemy ? enemy.instanceId : null });
  }
}

// Damage the player ignores block entirely (self-inflicted payoffs).
function dealSelfDamage(s, n) {
  if (n <= 0) return;
  s.player.hp -= n;
  logMsg(`You take ${n} self-damage.`);
  if (typeof queueAnim === "function") queueAnim({ kind: "playerDamage", amount: n });
}

// --- player buffs / resources ----------------------------------------------

function gainBlock(s, base, opts = {}) {
  const amount = blk(s, base, opts.card);
  s.player.block += amount;
  logMsg(`You gain ${amount} Block.`);
  if (typeof queueAnim === "function" && amount > 0) queueAnim({ kind: "playerBlock", amount });
  const m = s.currentCombat && s.currentCombat.mods;
  if (m && m.onBlockDamage > 0 && amount > 0) dealDamageRandom(s, m.onBlockDamage);
  if (typeof fireArtifacts === "function" && amount > 0) fireArtifacts("onGainBlock", s, amount);

  // Leech Mass: enemies heal whenever you gain Block (punishes turtling).
  if (s.currentCombat && amount > 0) {
    s.currentCombat.enemies.forEach((e) => {
      if (e.healOnPlayerBlock && e.hp > 0) {
        e.hp = Math.min(e.maxHp, e.hp + e.healOnPlayerBlock);
        logMsg(`${e.name} feeds on your defenses (+${e.healOnPlayerBlock} HP).`);
      }
    });
  }
}

function healPlayer(s, amount) {
  // Voidmaw: no healing while it lives (rewards block/burst over sustain).
  if (s.currentCombat && s.currentCombat.enemies.some((e) => e.hp > 0 && e.blocksHealing)) {
    logMsg("A void presence smothers your healing.");
    return;
  }
  const before = s.player.hp;
  s.player.hp = Math.min(s.player.maxHp, s.player.hp + amount);
  const healed = s.player.hp - before;
  if (healed > 0) {
    logMsg(`You heal ${healed} HP.`);
    if (typeof queueAnim === "function") queueAnim({ kind: "playerHeal", amount: healed });
  }
}

function gainEnergy(s, n) {
  s.player.energy += n;
  if (typeof queueAnim === "function" && n > 0) queueAnim({ kind: "playerEnergy", amount: n });
}

// Raise a per-combat mod (Shoot/Knife/Shield buffs, Auto-Block) AND queue its
// animation, so every stat gain in a fight visibly pulses on the player.
// Cards call this instead of poking currentCombat.mods directly.
function applyCombatMod(s, key, amount, label) {
  const m = s.currentCombat && s.currentCombat.mods;
  if (!m) return;
  m[key] = (m[key] || 0) + amount;
  if (typeof queueAnim === "function" && amount > 0) {
    if (key === "autoBlock") queueAnim({ kind: "autoBlock", amount });
    else queueAnim({ kind: "playerBuff", stat: label || key, amount });
  }
}

function gainRadiation(s, n) {
  // Radiation Suit relic reduces positive gains (never turns a gain into a loss).
  if (n > 0 && s.player.radReduction > 0) n = Math.max(0, n - s.player.radReduction);
  const before = s.player.radiation;
  const next = Math.max(0, Math.min(RAD_MAX, before + n));
  s.player.radiation = next;
  if (n > 0) {
    logMsg(`You gain ${n} Radiation.`);
    if (typeof queueAnim === "function") queueAnim({ kind: "playerRad", amount: n });
    if (typeof fireArtifacts === "function") fireArtifacts("onGainRadiation", s, n);
  } else if (n < 0) {
    logMsg(`You lose ${before - next} Radiation.`);
  }
}

function applyStrength(s, n) {
  s.player.strength += n;
  logMsg(`You gain ${n} Strength.`);
  if (typeof queueAnim === "function" && n > 0) queueAnim({ kind: "playerBuff", stat: "Strength", amount: n });
}

function applyDex(s, n) {
  s.player.dexterity += n;
  logMsg(`You gain ${n} Dexterity.`);
  if (typeof queueAnim === "function" && n > 0) queueAnim({ kind: "playerBuff", stat: "Dexterity", amount: n });
}

function gainCredits(s, n) {
  s.player.credits += n;
}

// --- card movement ----------------------------------------------------------

function drawCards(s, n) {
  const p = s.player;
  let drawn = 0;
  for (let i = 0; i < n; i++) {
    if (p.drawPile.length === 0) {
      if (p.discardPile.length === 0) break;
      p.drawPile = shuffle(p.discardPile);
      p.discardPile = [];
      logMsg("Reshuffled discard into draw pile.");
    }
    if (p.hand.length >= MAX_HAND_SIZE) break;
    p.hand.push(p.drawPile.pop());
    drawn++;
  }
  // mid-turn draws (card riders) animate pile->hand; turn-start draws are
  // drained before render and animated explicitly by the combat loop instead.
  if (drawn > 0 && typeof queueAnim === "function") queueAnim({ kind: "cardsDrawn", count: drawn });
}

function drawUpTo(s, n) {
  while (s.player.hand.length < n) {
    const before = s.player.hand.length;
    drawCards(s, 1);
    if (s.player.hand.length === before) break;
  }
}

function discardHand(s) {
  const p = s.player;
  while (p.hand.length) p.discardPile.push(p.hand.pop());
}

// Return the most recently discarded card (that isn't `exceptId`) to hand.
function returnLastDiscardToHand(s, exceptId) {
  const p = s.player;
  for (let i = p.discardPile.length - 1; i >= 0; i--) {
    if (p.discardPile[i].instanceId !== exceptId) {
      const [card] = p.discardPile.splice(i, 1);
      p.hand.push(card);
      logMsg(`${card.name} returns to your hand.`);
      return;
    }
  }
}

// Count Loot-tagged cards currently in hand (big-deck payoffs).
function lootInHand(s) {
  return s.player.hand.filter((c) => c.tags && c.tags.includes("loot")).length;
}
// Count Loot-tagged cards in the whole deck (Improvised Arsenal).
function lootInDeck(s) {
  return s.player.deck.filter((c) => c.tags && c.tags.includes("loot")).length;
}

// --- junk / stun ------------------------------------------------------------
// (Capture now lives on Tranquilizer Dart: a lethal hit sets enemy.captured,
//  which cleanUpEnemies routes to the capture loot table.)

// Permanently shuffle cards into the backpack (plants shooting nettles/spores,
// etc.). They enter the master deck — so they PERSIST between encounters — and
// get shuffled into this combat's draw pile so they can show up right away.
function addCardPermanent(s, templateId, n = 1) {
  for (let i = 0; i < n; i++) {
    const card = makeCard(templateId);
    s.player.deck.push(card);
    if (s.player.drawPile) {
      s.player.drawPile.splice(randInt(0, s.player.drawPile.length), 0, card);
    }
  }
}
function addJunkPermanent(s, n = 1) {
  addCardPermanent(s, "junk", n);
}

function stunAllEnemies(s, turns = 1) {
  s.currentCombat.enemies.forEach((e) => (e.stunned = (e.stunned || 0) + turns));
  logMsg("Enemies are stunned!");
}
