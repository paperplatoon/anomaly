// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// Combat loop. Slay-the-Spire layout + paced, sequential animations.
//
// Two execution paths share the same state logic:
//   - instantCombat (no browser): everything resolves synchronously. Keeps the
//     headless tests working and is the single source of truth for outcomes.
//   - animated (browser): state still mutates synchronously inside each action,
//     but presentation is paced with awaits. An `animating` lock ignores input
//     mid-sequence. render() is called only at rest; during a sequence the
//     animation layer updates HP bars / numbers surgically (bars CSS-transition).
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

let animating = false;
const instantCombat = typeof window === "undefined";
const ENEMY_CAP = 6; // max enemies on the field (summon cap)

function startEnergyPenalty(s) {
  return s.player.radiation >= 15 ? 1 : 0;
}

// Energy granted at the start of a turn. Central so relics stack into it:
//   base maxEnergy - radiation penalty + energyPerTurn (every turn)
//   + turn1Energy (turn 1 only, can be negative — Stone Flower).
function turnEnergy(s, turnNumber) {
  let e = s.player.maxEnergy - startEnergyPenalty(s) + s.player.energyPerTurn;
  if (turnNumber === 1) e += s.player.turn1Energy;
  return Math.max(0, e);
}

// Cards drawn at the start of a turn (base 5 + relic extraDrawPerTurn).
function turnDraw(s) {
  return 5 + s.player.extraDrawPerTurn;
}

function startCombat(enemyIds, opts = {}) {
  const s = state;
  const p = s.player;
  animating = false;
  if (typeof clearAnims === "function") clearAnims();

  p.energy = turnEnergy(s, 1);
  p.block = 0;
  p.strength = 0;
  p.dexterity = 0;
  p.hand = [];
  p.discardPile = [];
  p.exhaustPile = [];
  p.drawPile = shuffle(p.deck.map((c) => c));

  // HP/damage scaling — easy to crank per encounter (default = 1).
  const enemyScale = { hpMult: opts.hpMult ?? 1, dmgMult: opts.dmgMult ?? 1 };

  s.currentCombat = {
    enemies: enemyIds.map((id) => makeEnemy(id, enemyScale)),
    enemyScale,
    sporePlayed: 0,
    turnNumber: 1,
    selectedEnemyIndex: 0,
    cardsPlayedThisTurn: [],
    totalCardsPlayed: 0,
    lastCardPlayed: null,
    fxCard: null,
    isBoss: !!opts.isBoss,
    isElite: !!opts.isElite,
    isLandmark: !!opts.isLandmark, // landmark boss -> guaranteed relic on victory
    dudUsed: false, // Dud Ammo: first shoot card each combat is a dud
    mods: {
      shootDamage: 0, shieldBlock: 0, knifeDamage: 0, knifeCostZero: false,
      blockRetainPct: 0, onBlockDamage: 0, blockPerLootPlayed: 0,
      bonusHits: 0, bonusBlockTimes: 0, bonusDraw: 0,
      autoBlock: 0, // Block gained automatically at end of every turn
    },
    startTurnPowers: [],
    endTurnPowers: [],
    nextCardDouble: false,
    nextShootDouble: false,
    doubleLoot: false,
    playerAttackPenalty: 0, // Millipede: -atk this turn, resets each turn
    lootEatenThisTurn: false, // Giant Crow

    rewardContext: { capturedEnemies: [], killedEnemies: [] },
  };

  s.currentCombat.enemies.forEach((e) => (e.intent = rollIntent(e)));
  if (typeof fireArtifacts === "function") fireArtifacts("onCombatStart", s);
  drawCards(s, turnDraw(s));
  if (typeof drainAnimQueue === "function") drainAnimQueue();
  s.status = Status.COMBAT;
  render();
  // opening hand flies out of the draw pile
  if (!instantCombat && typeof animateDrawFly === "function") animateDrawFly(p.hand.length);
}

// ----- targeting ----------------------------------------------------------

function getTargetEnemy(s, targetIndex) {
  const enemies = s.currentCombat.enemies;
  if (targetIndex != null && enemies[targetIndex] && enemies[targetIndex].hp > 0) {
    return enemies[targetIndex];
  }
  const selected = enemies[s.currentCombat.selectedEnemyIndex];
  if (selected && selected.hp > 0) return selected;
  return enemies.find((e) => e.hp > 0) || null;
}

function selectEnemy(index) {
  if (animating) return;
  state.currentCombat.selectedEnemyIndex = index;
  render();
}

// ----- playing a card -----------------------------------------------------

// Synchronous state mutation for a card play (energy, effect, destination).
function resolvePlayCardState(s, card, target, cost) {
  const p = s.player;
  const combat = s.currentCombat;
  const idx = p.hand.findIndex((c) => c.instanceId === card.instanceId);

  p.energy -= cost;
  card.playCountThisCombat += 1;
  if (idx >= 0) p.hand.splice(idx, 1);
  combat.cardsPlayedThisTurn.push(card);

  const applyDouble = combat.nextCardDouble && card.templateId !== "calibration";
  const applyShootDouble =
    combat.nextShootDouble && card.tags && card.tags.includes("shoot") && card.templateId !== "doubleTap";
  if (applyDouble) combat.nextCardDouble = false;
  if (applyShootDouble) combat.nextShootDouble = false;

  // Relic on-play triggers (Auto Targeting, Bullet Shield, Blood Transfusion,
  // Shield Totem, Scrapper's Instinct...). Fired before the effect resolves so
  // damage/block buffs apply to this very card.
  if (typeof fireArtifacts === "function") fireArtifacts("onPlayCard", s, card);

  // Giant Crow: every loot card played buffs it; the first each turn is "eaten"
  // (its effect is negated). Applies before the effect resolves.
  let eaten = false;
  if (card.tags && card.tags.includes("loot")) {
    combat.enemies.forEach((e) => { if (e.strengthOnLootPlay && e.hp > 0) e.strength += e.strengthOnLootPlay; });
    const crow = combat.enemies.find((e) => e.eatsFirstLoot && e.hp > 0);
    if (crow && !combat.lootEatenThisTurn) { combat.lootEatenThisTurn = true; eaten = true; }
  }

  // Dud Ammo relic: the first shoot card each combat deals nothing and is
  // permanently removed from the deck.
  let dud = false;
  if (typeof hasArtifact === "function" && hasArtifact("dudAmmo") && !combat.dudUsed &&
      card.tags && card.tags.includes("shoot")) {
    combat.dudUsed = true;
    dud = true;
  }

  combat.fxCard = card;
  if (!eaten && !dud) {
    resolveCardEffect(s, card, target);
    if (applyDouble || applyShootDouble) resolveCardEffect(s, card, target);
  }
  combat.fxCard = null;

  if (combat.mods.blockPerLootPlayed > 0 && card.tags && card.tags.includes("loot")) {
    gainBlock(s, combat.mods.blockPerLootPlayed);
  }
  // gun/shield/knife equipment-buff skills get a flourish
  if (card.tags && card.tags.includes("equipment") && typeof queueAnim === "function") {
    queueAnim({ kind: "powerPlayed", name: card.name });
  }
  // Spore Plant scales off spore cards you play this combat.
  if (card.tags && card.tags.includes("spore")) combat.sporePlayed = (combat.sporePlayed || 0) + 1;

  if (card.consumedOnUse || dud) {
    const di = p.deck.findIndex((c) => c.instanceId === card.instanceId);
    if (di !== -1) p.deck.splice(di, 1);
    if (!dud && typeof fireArtifacts === "function") fireArtifacts("onRemoveSingleUse", s, card);
  } else if (card.refills || card.exhaustsForCombat) {
    // "Refills": used once per combat, then recharges (returns next fight).
    // Mass Converter relic recharges them immediately (back to the draw pile).
    if (typeof hasArtifact === "function" && hasArtifact("massConverter")) {
      p.drawPile.push(card);
    } else {
      p.exhaustPile.push(card);
    }
  } else {
    p.discardPile.push(card);
  }
  combat.lastCardPlayed = card.templateId;
  combat.totalCardsPlayed += 1; // counts prior plays for "if you've played N already"
}

// Run a card's action + its standard numeric riders (currently: draw). Called
// once per resolution, so a doubled card (Calibration) draws twice too.
function resolveCardEffect(s, card, target) {
  card.action(s, card, target);
  const drawN = effectiveDraw(s, card);
  if (drawN > 0) drawCards(s, drawN);
  if (card.healOnPlay > 0) healPlayer(s, card.healOnPlay); // rider added by events
}

async function playCard(cardInstanceId, targetIndex = null) {
  const s = state;
  if (animating || !s.currentCombat) return;
  const p = s.player;

  const card = p.hand.find((c) => c.instanceId === cardInstanceId);
  if (!card) return;
  const cost = effectiveCost(s, card);
  if (cost > p.energy) return;

  let target = null;
  if (card.target === "enemy") {
    target = getTargetEnemy(s, targetIndex);
    if (!target) return;
  }

  if (typeof drainAnimQueue === "function") drainAnimQueue();
  resolvePlayCardState(s, card, target, cost);
  const events = typeof drainAnimQueue === "function" ? drainAnimQueue() : [];
  cleanUpEnemies(s);

  if (instantCombat) {
    finalizePlayer(s);
    return;
  }

  animating = true;
  if (typeof spawnCardGhostById === "function") spawnCardGhostById(card.instanceId);
  // discard-bound cards visibly fly into the discard pile
  if (typeof flyPlayedCardToDiscard === "function" && !card.consumedOnUse && !card.refills && !card.exhaustsForCombat) {
    flyPlayedCardToDiscard(card.instanceId);
  }
  if (typeof removeHandCardEl === "function") removeHandCardEl(card.instanceId);
  if (typeof setPlayerBars === "function") setPlayerBars();
  if (typeof playPlayerCardEvents === "function") await playPlayerCardEvents(events);
  animating = false;
  finalizePlayer(s);
}

function finalizePlayer(s) {
  if (s.beaconExtract) {
    s.beaconExtract = false;
    resetCardCombatCounters(s);
    extractRun();
    return;
  }
  if (s.player.hp <= 0) return endCombat(s, "defeat");
  if (s.currentCombat.enemies.length === 0) return endCombat(s, "victory");
  render();
}

// Move dead/captured enemies out of the combat array (DOM lingers until render).
function cleanUpEnemies(s) {
  const combat = s.currentCombat;
  const survivors = [];
  combat.enemies.forEach((e) => {
    if (e.hp <= 0) {
      if (e.marked) gainCredits(s, e.markBonus || 5);
      if (typeof e.onDefeat === "function") e.onDefeat(s); // permanent on-defeat effects
      if (e.captured) combat.rewardContext.capturedEnemies.push(e);
      else combat.rewardContext.killedEnemies.push(e);
    } else {
      survivors.push(e);
    }
  });
  combat.enemies = survivors;
  if (combat.selectedEnemyIndex >= survivors.length) combat.selectedEnemyIndex = 0;
}

// ----- enemy move application (shared by both paths) ----------------------

function enemyTurnStartPassives(s, enemy) {
  if (enemy.regen && enemy.hp > 0) enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.regen);
  if (enemy.punishUnspentEnergy && s.player.energy > 0) {
    enemy.block += s.player.energy * enemy.punishUnspentEnergy;
  }
}

function summonEnemy(s, templateId) {
  const combat = s.currentCombat;
  if (!templateId || combat.enemies.length >= ENEMY_CAP) return;
  const e = makeEnemy(templateId, combat.enemyScale || {});
  e.intent = rollIntent(e);
  combat.enemies.push(e);
}

// The single source of truth for what an enemy move does (both paths call it).
function affectAllies(s, allyTag, fn) {
  s.currentCombat.enemies.forEach((e) => {
    if (e.hp > 0 && (!allyTag || (e.tags && e.tags.includes(allyTag)))) fn(e);
  });
}

function applyEnemyMove(s, enemy, move) {
  if (move.type === "attack") {
    const hpBefore = s.player.hp;
    const hits = move.hits || 1;
    for (let i = 0; i < hits; i++) {
      const b = s.player.hp;
      dealPlayerDamage(s, move.damage, enemy);
      if (move.radPerHit && s.player.hp < b) gainRadiation(s, move.radPerHit); // per damaging hit
      if (s.player.hp <= 0) break;
    }
    const dealtDamage = s.player.hp < hpBefore;
    if (move.radiation && s.player.hp > 0) gainRadiation(s, move.radiation);
    if (move.strengthIfDamaged && dealtDamage) enemy.strength += move.strengthIfDamaged;
    if (move.healSelf) {
      const heal = move.healSelf + (move.healRamp || 0) * (enemy._turnsActed || 0);
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + heal);
    }
  } else if (move.type === "block") {
    enemy.block += move.block;
  } else if (move.type === "buff") {
    if (move.strength) enemy.strength += move.strength;
    if (move.aim) enemy.nextAttackBonus = (enemy.nextAttackBonus || 0) + move.aim;
    if (move.blockGain) enemy.block += move.blockGain;
  } else if (move.type === "debuff") {
    if (move.radiation) gainRadiation(s, move.radiation);
  } else if (move.type === "junk") {
    addJunkPermanent(s, move.junk || 1);
  } else if (move.type === "summon") {
    summonEnemy(s, move.summon);
  } else if (move.type === "healAllies") {
    affectAllies(s, move.allyTag, (e) => (e.hp = Math.min(e.maxHp, e.hp + move.amount)));
  } else if (move.type === "buffAllies") {
    affectAllies(s, move.allyTag, (e) => (e.strength += move.strength));
  }
  // riders available on any move type
  if (move.addsCard) addCardPermanent(s, move.addsCard.templateId, move.addsCard.count || 1);
  if (move.selfDamage) enemy.hp -= move.selfDamage;
}

function enemyAct(s, enemy) {
  const move = refreshIntent(enemy) || rollIntent(enemy);
  applyEnemyMove(s, enemy, move);
  recordEnemyMove(enemy, move); // counters + cooldowns for the AI rules
  enemy.intent = rollIntent(enemy);
}

function runEndOfTurnPowers(s) {
  s.currentCombat.endTurnPowers.forEach((fn) => fn(s));
}

// ----- ending the turn ----------------------------------------------------

async function endTurn() {
  const s = state;
  if (animating || !s.currentCombat) return;

  runEndOfTurnPowers(s);
  const autoBlk = autoBlockValue(s); // Auto-Block: gain Block at the end of every turn
  if (autoBlk > 0) gainBlock(s, autoBlk);
  if (s.player.hp <= 0) return endCombat(s, "defeat");
  // snapshot hand positions BEFORE discarding so the ghosts fly from where the
  // cards actually were
  const handPoints = !instantCombat && typeof captureHandRects === "function" ? captureHandRects() : null;
  discardHand(s);

  if (instantCombat) {
    for (const enemy of s.currentCombat.enemies) {
      if (enemy.hp <= 0) continue;
      if (enemy.stunned > 0) { enemy.stunned -= 1; enemy.intent = rollIntent(enemy); continue; }
      enemyTurnStartPassives(s, enemy);
      enemyAct(s, enemy);
      if (s.player.hp <= 0) return endCombat(s, "defeat");
    }
    finishEnemyTurn(s);
    return;
  }

  animating = true;
  if (typeof drainAnimQueue === "function") drainAnimQueue();
  render(); // rest snapshot: hand discarded, current intents shown
  if (handPoints && typeof animateDiscardFly === "function") animateDiscardFly(handPoints);
  // Auto-Block triggering is its own visible beat before the enemy turn
  if (autoBlk > 0 && typeof spawnAutoBlockFx === "function") {
    spawnAutoBlockFx();
    floatText(playerAvatarEl(), `⛨ +${autoBlk}`, "block");
    await pause(340);
  }
  await pause(220);
  if (typeof spawnBanner === "function") spawnBanner("ENEMY TURN");
  await pause(340);

  for (const enemy of [...s.currentCombat.enemies]) {
    if (enemy.hp <= 0) continue;
    if (enemy.stunned > 0) {
      enemy.stunned -= 1;
      if (typeof showEnemyStunned === "function") showEnemyStunned(enemy);
      enemy.intent = rollIntent(enemy);
      await pause(360);
      continue;
    }
    enemyTurnStartPassives(s, enemy);
    if (typeof setEnemyBar === "function") setEnemyBar(enemy.instanceId, enemy.hp, enemy.maxHp);
    await animateEnemyMove(s, enemy);
    if (typeof drainAnimQueue === "function") drainAnimQueue();
    if (s.player.hp <= 0) { animating = false; return endCombat(s, "defeat"); }
  }

  animating = false;
  finishEnemyTurn(s);
}

// Animated enemy move: windup -> lunge -> impact -> settle. Applies the move's
// state via the shared applyEnemyMove (no divergence with the instant path),
// then paints the resulting deltas.
async function animateEnemyMove(s, enemy) {
  const el = enemyEl(enemy.instanceId);
  const move = refreshIntent(enemy) || rollIntent(enemy);
  const playerEl = playerAvatarEl();
  const isAttack = move.type === "attack";
  const hpBefore = s.player.hp;
  const enemyHpBefore = enemy.hp;

  if (isAttack) { await enemyWindup(el); await enemyLunge(el); }
  else { await enemyFlex(el); }

  applyEnemyMove(s, enemy, move); // impact

  const dmg = hpBefore - s.player.hp;
  if (dmg > 0) {
    flashEl(playerEl, "impact");
    screenShake();
    floatText(playerEl, `-${dmg}`, dmg >= 15 ? "dmg big" : "dmg");
  } else if (isAttack) {
    spawnShield("BLOCKED", true);
  }
  if (move.radiation || (move.radPerHit && dmg > 0)) {
    const radShown = move.radiation || move.radPerHit * (move.hits || 1);
    floatText(playerEl, `+${radShown}☢`, "rad");
    spawnRadPulse(playerEl);
    await pause(260); // beat: radiation landing should be unmissable
  }
  if (move.addsCard) {
    const nm = cardTemplates[move.addsCard.templateId] ? cardTemplates[move.addsCard.templateId].name : "cards";
    floatText(playerEl, `+${move.addsCard.count || 1} ${nm}`, "power");
  }
  if (move.type === "junk") floatText(playerEl, "+JUNK", "rad");
  if (move.type === "summon" && el) { spawnAt(el, "buff-ring", 560); floatText(el, "SUMMON!", "buff"); }
  if (move.type === "block") { setEnemyBlock(enemy.instanceId, enemy.block); floatText(el, `+${move.block}\u{1F6E1}`, "block"); }
  if (move.type === "buff") {
    if (move.strength) floatText(el, `+${move.strength} STR`, "buff");
    if (move.aim) floatText(el, "TAKING AIM", "buff");
    if (el) { spawnAt(el, "buff-ring", 560); enemyBuffGlow(el); }
  }
  if (move.strengthIfDamaged && dmg > 0) {
    floatText(el, `+${move.strengthIfDamaged} STR`, "buff");
    enemyBuffGlow(el);
  }
  if (move.type === "healAllies" || move.type === "buffAllies") {
    if (el) spawnAt(el, "buff-ring", 560);
    s.currentCombat.enemies.forEach((e) => {
      setEnemyBar(e.instanceId, e.hp, e.maxHp);
      floatText(enemyEl(e.instanceId), move.type === "healAllies" ? `+${move.amount}` : `+${move.strength} STR`, move.type === "healAllies" ? "heal" : "buff");
      if (move.type === "buffAllies") enemyBuffGlow(enemyEl(e.instanceId));
    });
  }
  if (enemy.hp !== enemyHpBefore) setEnemyBar(enemy.instanceId, enemy.hp, enemy.maxHp);
  setPlayerBars();

  await pause(280);
  if (isAttack) await enemySettle(el);

  recordEnemyMove(enemy, move); // counters + cooldowns for the AI rules
  enemy.intent = rollIntent(enemy);
}

function finishEnemyTurn(s) {
  const combat = s.currentCombat;
  // enemies can die on their own turn (nettle self-damage); tidy up + check win
  cleanUpEnemies(s);
  if (combat.enemies.length === 0) return endCombat(s, "victory");
  const retain = combat.mods.blockRetainPct;
  s.player.block = retain > 0 ? Math.floor(s.player.block * (retain / 100)) : 0;

  combat.turnNumber += 1;
  combat.cardsPlayedThisTurn = [];
  combat.playerAttackPenalty = 0; // Millipede penalty resets each turn
  combat.lootEatenThisTurn = false; // Crow can eat again
  combat.enemies.forEach((e) => (e._firstHitDone = false));
  s.player.energy = turnEnergy(s, combat.turnNumber);
  drawCards(s, turnDraw(s));

  combat.startTurnPowers.forEach((fn) => fn(s));
  if (typeof fireArtifacts === "function") fireArtifacts("onStartTurn", s);
  if (typeof drainAnimQueue === "function") drainAnimQueue();

  if (s.player.hp <= 0) return endCombat(s, "defeat");
  render();
  // new hand flies out of the draw pile
  if (!instantCombat && typeof animateDrawFly === "function") animateDrawFly(s.player.hand.length);
}

// ----- end of combat ------------------------------------------------------

// After-combat relic stat effects (heal / radiation swing / HP cost). Central
// so any relic that bumps these player.* stats contributes.
function applyPostCombatRelics(s) {
  const p = s.player;
  if (p.postCombatHeal > 0) healPlayer(s, p.postCombatHeal);
  if (p.postCombatRadRemove > 0) p.radiation = Math.max(0, p.radiation - p.postCombatRadRemove);
  if (p.postCombatRadGain > 0) gainRadiation(s, p.postCombatRadGain);
  if (p.postCombatHpLoss > 0) p.hp -= p.postCombatHpLoss;
}

function endCombat(s, result) {
  animating = false;
  s.player.energy = 0; // energy only exists inside combat (card previews read it)
  if (result === "victory") {
    const wasBoss = s.currentCombat.isBoss;
    const wasLandmark = s.currentCombat.isLandmark;
    const wasElite = s.currentCombat.isElite && !wasLandmark; // plain elite tile

    const radDmg = Math.floor(s.player.radiation / 3);
    if (radDmg > 0) s.player.hp -= radDmg;

    applyPostCombatRelics(s);
    if (typeof fireArtifacts === "function") fireArtifacts("onCombatEnd", s);

    const loot = generateCombatRewards(s);
    s.player.credits += loot.credits;

    // Relic sources: landmark bosses guarantee one; plain elites drop one 15% of
    // the time. Map relic tiles grant the rest. You collect more than you can
    // equip (5), and choose the active set on the equipment screen.
    s.pendingArtifact = null;
    if (typeof grantRandomArtifact === "function") {
      if (wasLandmark) s.pendingArtifact = grantRandomArtifact(s);
      else if (wasElite && Math.random() < 0.15) s.pendingArtifact = grantRandomArtifact(s);
    }
    resetCardCombatCounters(s);

    if (s.player.hp <= 0) { s.status = Status.DEATH; render(); return; }

    if (wasBoss) {
      s.meta.bankedCredits += s.player.credits;
      s.meta.bestRunValue = Math.max(s.meta.bestRunValue || 0, s.player.credits);
      if (typeof saveMeta === "function") saveMeta();
      s.runResult = {
        outcome: "boss", credits: s.player.credits, deckSize: s.player.deck.length,
        artifact: s.pendingArtifact ? s.pendingArtifact.name : null,
      };
      s.status = Status.VICTORY;
      render();
      return;
    }

    s.pendingRewards = loot.rewards;
    s.pendingRewardCredits = loot.credits;
    s.activeRewardIndex = null;
    s.status = Status.LOOT_REWARD;
  } else {
    s.status = Status.DEATH;
  }
  render();
}

function resetCardCombatCounters(s) {
  s.player.deck.forEach((c) => {
    c.playCountThisCombat = 0;
    c.combatDamage = 0; // per-combat scaling ("gain X damage this combat") resets
    c.combatBlock = 0;
  });
}
