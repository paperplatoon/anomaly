// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// Combat screen — Slay-the-Spire layout: player on the left, enemies on the
// right, hand along the bottom with the energy orb beside it. Player vitals
// (HP / Radiation / Block / buffs) live together by the player avatar. No log,
// no pile counters. Stable IDs let the animation layer update bars in place.
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

// `enemy` optional; when present, shown attack numbers include Strength + aim.
function intentText(move, enemy) {
  if (!move) return "…";
  let base;
  switch (move.type) {
    case "attack": {
      const bonus = enemy ? enemy.strength + (enemy.nextAttackBonus || 0) : 0;
      base = `⚔ ${Math.max(0, move.damage + bonus)}${move.hits ? ` ×${move.hits}` : ""}`;
      break;
    }
    case "block":
      base = `\u{1F6E1} ${move.block}`;
      break;
    case "buff":
      base = move.aim ? "◎ Aim" : "▲ Buff";
      break;
    case "debuff":
      base = move.radiation ? `☢ ${move.radiation}` : "▼ Debuff";
      break;
    case "junk":
      base = `✖ Junk ${move.junk || 1}`;
      break;
    case "summon":
      base = "✚ Summon";
      break;
    case "healAllies":
      base = `✚ Heal ${move.amount}`;
      break;
    case "buffAllies":
      base = `▲ Empower ${move.strength}`;
      break;
    case "idle":
      base = "…";
      break;
    default:
      base = move.name;
  }
  if (move.addsCard) base += ` +${move.addsCard.count || 1}✷`;
  if (move.radiation && move.type === "attack") base += ` ☢${move.radiation}`;
  return base;
}

// A move is "plain damage" if it just attacks — no riders, no other effect. Those
// need no explanation; everything else gets a text line under the avatar.
function intentIsPlainDamage(move) {
  return (
    !!move && move.type === "attack" &&
    !move.radiation && !move.radPerHit && !move.addsCard &&
    !move.strengthIfDamaged && !move.healSelf && !move.selfDamage
  );
}

// Plain-English "here's exactly what it will do" for anything that isn't plain
// damage. Returns null for plain-damage attacks (the ⚔ number already says it).
function intentDescription(move, enemy) {
  if (!move || intentIsPlainDamage(move)) return null;
  const bonus = enemy ? enemy.strength + (enemy.nextAttackBonus || 0) : 0;
  const parts = [];

  switch (move.type) {
    case "attack":
      parts.push(`Attacks for ${Math.max(0, move.damage + bonus)}${move.hits > 1 ? ` ${move.hits}×` : ""}`);
      break;
    case "block":
      parts.push(`Defends (+${move.block} Block)`);
      break;
    case "buff":
      if (move.aim) parts.push(`Takes aim (+${move.aim} next attack)`);
      if (move.strength) parts.push(`Empowers itself (+${move.strength} Strength)`);
      if (move.blockGain) parts.push(`Braces (+${move.blockGain} Block)`);
      if (!move.aim && !move.strength && !move.blockGain) parts.push("Steels itself");
      break;
    case "debuff":
      if (move.radiation) parts.push(`Irradiates you (+${move.radiation} Radiation)`);
      else if (!move.addsCard) parts.push("Weakens you"); // else the addsCard rider describes it
      break;
    case "junk":
      parts.push(`Clogs your deck (+${move.junk || 1} Junk)`);
      break;
    case "summon":
      parts.push("Summons an ally");
      break;
    case "healAllies":
      parts.push(`Heals allies (+${move.amount} HP)`);
      break;
    case "buffAllies":
      parts.push(`Empowers allies (+${move.strength} Strength)`);
      break;
    case "idle":
      parts.push("Bides its time");
      break;
    default:
      parts.push(move.name || "Acts");
  }

  // riders (mostly ride along on attacks)
  if (move.radiation && move.type === "attack") parts.push(`+${move.radiation} Radiation`);
  if (move.radPerHit) parts.push(`+${move.radPerHit} Radiation per hit`);
  if (move.addsCard) {
    const nm = cardTemplates[move.addsCard.templateId] ? cardTemplates[move.addsCard.templateId].name : "cards";
    parts.push(`adds ${move.addsCard.count || 1} ${nm} to your deck`);
  }
  if (move.strengthIfDamaged) parts.push(`grows if it hits you (+${move.strengthIfDamaged} Strength)`);
  if (move.healSelf) parts.push(`heals itself ${move.healSelf + (move.healRamp || 0) * (enemy ? enemy._turnsActed || 0 : 0)}`);

  return parts.join(", ");
}

function enemyPassiveLabel(enemy) {
  if (enemy.strengthOnHit) return `Enrage +${enemy.strengthOnHit}/hit`;
  if (enemy.thorns) return `Thorns ${enemy.thorns}`;
  if (enemy.halveFirstHit) return "Phased";
  if (enemy.healOnPlayerBlock) return `Leech ${enemy.healOnPlayerBlock}`;
  if (enemy.deckScaleStrength) return "Hoarder";
  if (enemy.blocksHealing) return "No-Heal";
  if (enemy.regen) return `Regen ${enemy.regen}`;
  if (enemy.punishUnspentEnergy) return "Overload";
  if (enemy.startBlock) return "Armored";
  return null;
}

function hpBar(current, max, id) {
  const pct = Math.max(0, (current / max) * 100);
  return el("div", { class: "hp-bar", id }, [
    el("div", { class: "hp-bar-fill", attrs: { style: `width:${pct}%` } }),
    el("div", { class: "hp-bar-text", text: `${Math.max(0, current)}/${max}` }),
  ]);
}

// ----- player side ---------------------------------------------------------

// ----- player passive indicators -------------------------------------------
// Declarative registry: every active passive shows as a little chip with a
// hover tooltip. `value(s)` falsy = hidden. To surface a new passive, add an
// entry here — nothing else to wire.
const PLAYER_PASSIVES = [
  { id: "str", cls: "str", chip: (v) => `STR ${v}`, title: "Strength",
    tip: (v) => `Your attacks deal +${v} damage.`, value: (s) => s.player.strength },
  { id: "dex", cls: "dex", chip: (v) => `DEX ${v}`, title: "Dexterity",
    tip: (v) => `Your Block gains are increased by ${v}.`, value: (s) => s.player.dexterity },
  { id: "autoBlock", cls: "autoblock", chip: (v) => `⛨ ${v}`, title: "Auto-Block",
    tip: (v) => `Gain ${v} Block automatically at the end of every turn.`,
    value: (s) => autoBlockValue(s) },
  { id: "shootMod", cls: "str", chip: (v) => `◎ +${v}`, title: "Aim (this combat)",
    tip: (v) => `Your Shoot cards deal +${v} damage this combat.`,
    value: (s) => s.currentCombat.mods.shootDamage },
  { id: "knifeMod", cls: "str", chip: (v) => `🔪 +${v}`, title: "Combat Skill (this combat)",
    tip: (v) => `Your Knife cards deal +${v} damage this combat.`,
    value: (s) => s.currentCombat.mods.knifeDamage },
  { id: "shieldMod", cls: "dex", chip: (v) => `🛡 +${v}`, title: "Reinforced (this combat)",
    tip: (v) => `Your Shield cards gain +${v} Block this combat.`,
    value: (s) => s.currentCombat.mods.shieldBlock },
  { id: "retain", cls: "dex", chip: (v) => `⟲ ${v}%`, title: "Block Retention",
    tip: (v) => `You keep ${v}% of your unspent Block between turns.`,
    value: (s) => s.currentCombat.mods.blockRetainPct },
  { id: "blockThorns", cls: "str", chip: (v) => `☇ ${v}`, title: "Shield Spikes",
    tip: (v) => `Whenever you gain Block, deal ${v} damage to a random enemy.`,
    value: (s) => s.currentCombat.mods.onBlockDamage },
  { id: "lootBlock", cls: "dex", chip: (v) => `◆ +${v}`, title: "Scrapper's Cover",
    tip: (v) => `Gain ${v} Block whenever you play a Loot card.`,
    value: (s) => s.currentCombat.mods.blockPerLootPlayed },
  { id: "bonusDraw", chip: (v) => `DRAW +${v}`, title: "Extra Draw",
    tip: (v) => `Cards that draw give you ${v} extra card(s).`,
    value: (s) => s.currentCombat.mods.bonusDraw + (s.player.bonusDraw || 0) },
  { id: "bonusHits", cls: "str", chip: (v) => `↯ +${v}`, title: "Extra Hits",
    tip: (v) => `Your multi-hit attacks strike ${v} extra time(s).`,
    value: (s) => s.currentCombat.mods.bonusHits },
  { id: "doubleNext", chip: () => "2×", title: "Echo",
    tip: () => "Your next card is played twice.",
    value: (s) => s.currentCombat.nextCardDouble },
  { id: "doubleShoot", chip: () => "2×◎", title: "Double Tap",
    tip: () => "Your next Shoot card is played twice.",
    value: (s) => s.currentCombat.nextShootDouble },
  { id: "doubleLoot", chip: () => "◆×2", title: "Scanner",
    tip: () => "Loot drops from this combat are doubled.",
    value: (s) => s.currentCombat.doubleLoot },
  { id: "gunPerm", cls: "str", chip: (v) => `◎ ${v}`, title: "Gun Bonus (permanent)",
    tip: (v) => `All your Shoot cards deal +${v} damage (equipment, events, upgrades).`,
    value: (s) => (s.player.shootBonus || 0) + equippedBonus(s, "shoot") },
  { id: "knifePerm", cls: "str", chip: (v) => `🔪 ${v}`, title: "Knife Bonus (permanent)",
    tip: (v) => `All your Knife cards deal +${v} damage (equipment, events, upgrades).`,
    value: (s) => (s.player.knifeBonus || 0) + equippedBonus(s, "knife") },
  { id: "shieldPerm", cls: "dex", chip: (v) => `🛡 ${v}`, title: "Shield Bonus (permanent)",
    tip: (v) => `All your Shield cards gain +${v} Block (equipment, events, upgrades).`,
    value: (s) => (s.player.blockBonus || 0) + equippedBonus(s, "block") },
];

function renderPassiveChips(s) {
  return PLAYER_PASSIVES.map((pd) => {
    const v = pd.value(s);
    if (!v) return null;
    return el("div", {
      class: ["buff-chip", pd.cls || null],
      text: pd.chip(v),
      onMouseEnter: (e) =>
        showAnchoredTip(e.currentTarget, pd.title, typeof pd.tip === "function" ? pd.tip(v) : pd.tip),
      onMouseLeave: hideCardTooltips,
    });
  });
}

function renderPlayerSide(s) {
  const p = s.player;

  const avatar = el("div", { class: ["player-avatar", "has-img"], id: "player-avatar" }, [
    el("img", { class: "player-img", attrs: { src: "img/stalker.png", alt: "", draggable: "false" } }),
    // shield bubble is state-keyed: exists iff block > 0 (synced mid-sequence
    // by syncShieldBubble in animations.js)
    p.block > 0
      ? el("div", { class: "shield-bubble", attrs: { "data-block": String(p.block) } })
      : null,
    el("div", {
      class: "block-badge",
      id: "player-block",
      attrs: { style: p.block > 0 ? "" : "display:none" },
      text: p.block > 0 ? `\u{1F6E1} ${p.block}` : "",
    }),
  ]);

  const radPct = Math.min(1, p.radiation / RAD_MAX) * 100;
  const radBar = el("div", { class: ["rad-bar", p.radiation >= 15 ? "rad-warning" : null], id: "player-rad" }, [
    el("div", { class: "rad-bar-fill", attrs: { style: `width:${radPct}%` } }),
    el("div", { class: "rad-bar-text", text: `☢ ${p.radiation}/${RAD_MAX}` }),
  ]);

  const buffs = el("div", { class: "buff-row", id: "player-buffs" }, renderPassiveChips(s));

  return el("div", { class: "player-side" }, [
    avatar,
    el("div", { class: "combatant-name", text: "Scavenger" }),
    hpBar(p.hp, p.maxHp, "player-hp"),
    radBar,
    buffs,
  ]);
}

// ----- enemy side ----------------------------------------------------------

// Enemy avatar art (files in img/enemies/). Easy foes have their own art; medium
// foes reuse a thematically-close image FOR NOW and get a red overlay to read as
// a stronger variant. Enemies with no entry (bosses) fall back to the letter.
const ENEMY_IMAGE = {
  // easy — real art
  vampireBat: "vampirebat.png",
  nettlePlant: "nettleplant.png",
  rat: "rat.png",
  madTurtle: "turtle.png",
  irradiatedFox: "fox.png",
  giantLeech: "leech.png",
  fungalGrowth: "fungalgrowth.png",
  parasiticFern: "parasiticfern.png",
  // medium — placeholder art reused from the closest easy foe
  sporePlant: "fungalgrowth.png",
  poisonousVines: "nettleplant.png",
  faunaMonstrosity: "leech.png",
  fungalColony: "fungalgrowth.png",
  irradiatedWolf: "fox.png",
};

function renderEnemyAvatar(enemy) {
  const imgFile = ENEMY_IMAGE[enemy.templateId];
  const isMedium = enemy.difficulty === "medium";
  const kids = [];
  if (imgFile) {
    kids.push(el("img", { class: "enemy-img", attrs: { src: `img/enemies/${imgFile}`, alt: "", draggable: "false" } }));
    if (isMedium) kids.push(el("div", { class: "avatar-red-overlay" }));
  }
  kids.push(el("div", {
    class: "block-badge",
    attrs: { style: enemy.block > 0 ? "" : "display:none" },
    text: enemy.block > 0 ? `\u{1F6E1} ${enemy.block}` : "",
  }));
  return el("div", {
    class: ["enemy-avatar", `avatar-${enemy.type}`, imgFile ? "has-img" : null, isMedium ? "avatar-medium" : null],
    text: imgFile ? null : enemy.name[0],
  }, kids);
}

function renderEnemy(s, enemy, index) {
  const isSelected = index === s.currentCombat.selectedEnemyIndex;
  const isElite = enemy.tags && enemy.tags.includes("elite");
  const isBoss = enemy.tags && enemy.tags.includes("boss");
  const passive = enemyPassiveLabel(enemy);
  // recompute dynamic intents so shown values track live state (fern/spore/etc.)
  const intent = typeof refreshIntent === "function" ? refreshIntent(enemy) : enemy.intent;
  const intentDesc = intentDescription(intent, enemy);

  return el("div", {
    class: [
      "enemy",
      isSelected ? "enemy-selected" : null,
      isElite ? "enemy-elite" : null,
      isBoss ? "enemy-boss" : null,
    ],
    onClick: () => selectEnemy(index),
    attrs: { "data-iid": enemy.instanceId },
  }, [
    el("div", { class: "enemy-intent", text: intentText(intent, enemy) }),
    renderEnemyAvatar(enemy),
    el("div", { class: "combatant-name", text: enemy.name }),
    intentDesc ? el("div", { class: "enemy-intent-desc", text: intentDesc }) : null,
    passive ? el("div", { class: "enemy-passive", text: passive }) : null,
    hpBar(enemy.hp, enemy.maxHp),
  ]);
}

// ----- hand + energy -------------------------------------------------------

function renderHandCard(s, card) {
  const cost = effectiveCost(s, card);
  const affordable = cost <= s.player.energy;
  // ghost + removal are handled inside playCard's animated path
  const node = renderCardFace(s, card, {
    onClick: affordable ? () => playCard(card.instanceId) : null,
    disabled: !affordable,
  });
  node.setAttribute("data-cid", card.instanceId);
  return node;
}

function renderEnergyOrb(s) {
  const p = s.player;
  return el("div", { class: "energy-orb", id: "energy-orb" }, [
    el("div", { class: "energy-value", text: String(p.energy) }),
    el("div", { class: "energy-max", text: `/${p.maxEnergy}` }),
  ]);
}

// ----- draw / discard piles -----------------------------------------------

function pileFor(s, kind) {
  return kind === "draw" ? s.player.drawPile : s.player.discardPile;
}

// A neat stack-of-cards div with a count + label. Hovering shows every card
// currently in the pile (randomized order) in a big overlay.
function renderPile(s, kind) {
  const pile = pileFor(s, kind);
  const label = kind === "draw" ? "Draw" : "Discard";
  return el("div", {
    class: ["card-pile", `pile-${kind}`, pile.length === 0 ? "pile-empty" : null],
    onMouseEnter: () => showPileOverlay(s, kind),
    onMouseLeave: hidePileOverlay,
  }, [
    el("div", { class: "pile-stack" }),
    el("div", { class: "pile-count", text: String(pile.length) }),
    el("div", { class: "pile-label", text: label }),
  ]);
}

function hidePileOverlay() {
  const o = document.getElementById("pile-overlay");
  if (o) o.remove();
}

// Randomized so the player can't read the draw order. Rebuilt on each hover, so
// it always reflects the pile's current contents.
function showPileOverlay(s, kind) {
  hidePileOverlay();
  const pile = pileFor(s, kind);
  const label = kind === "draw" ? "Draw Pile" : "Discard Pile";
  const overlay = el("div", { id: "pile-overlay", class: "pile-overlay" }, [
    el("div", { class: "pile-overlay-title", text: `${label} — ${pile.length} card${pile.length === 1 ? "" : "s"} (random order)` }),
  ]);
  if (!pile.length) {
    overlay.append(el("div", { class: ["pile-overlay-empty", "muted"], text: "This pile is empty." }));
  } else {
    const cards = shuffle(pile.slice());
    overlay.append(el("div", { class: "pile-overlay-grid" }, cards.map((c) => renderCardFace(s, c, { showSell: false }))));
  }
  document.body.append(overlay);
}

// ----- screen --------------------------------------------------------------

function renderCombat(s) {
  const app = document.getElementById("app");
  const combat = s.currentCombat;
  const p = s.player;

  const screen = el("div", {
    class: ["combat-screen", p.hp <= p.maxHp * 0.25 ? "low-hp" : null],
  });

  // compact top strip: artifacts (left) · credits / turn / deck (right)
  const artifacts = renderArtifactStrip(s);
  screen.append(
    el("div", { class: "combat-topstrip" }, [
      artifacts || el("div", {}),
      el("div", { class: "topstrip-right" }, [
        el("span", { class: "topstrip-stat", text: `◈ ${p.credits}` }),
        el("span", { class: "topstrip-stat", text: `Turn ${combat.turnNumber}` }),
        el("button", { class: ["btn", "btn-small"], text: "Deck", onClick: openDeckModal }),
      ]),
    ])
  );

  // battlefield
  const enemySide = el(
    "div",
    { class: "enemy-side", id: "enemy-side" },
    combat.enemies.map((e, i) => renderEnemy(s, e, i))
  );
  screen.append(el("div", { class: "battlefield" }, [renderPlayerSide(s), enemySide]));

  // hand bar: energy orb · hand · end turn
  const hand = el(
    "div",
    { class: "hand" },
    p.hand.map((c, i) => {
      const node = renderHandCard(s, c);
      node.style.setProperty("--i", i);
      node.style.setProperty("--n", p.hand.length);
      return node;
    })
  );
  screen.append(
    el("div", { class: "handbar" }, [
      renderPile(s, "draw"),
      renderEnergyOrb(s),
      hand,
      el("button", { class: ["btn", "btn-primary", "end-turn-btn"], text: "End Turn", onClick: endTurn }),
      renderPile(s, "discard"),
    ])
  );

  app.append(screen);
}

registerRenderer(Status.COMBAT, renderCombat);
