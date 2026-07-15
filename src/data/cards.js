// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// Card templates + makeCard() factory + starting deck.
//
// Imported from "Zone game cards (2).xlsx" (the design source of truth). Plus
// the enemy-generated cards (Junk / Nettle / Anti-Rad Spore / …) with leaf art.
//
// Every player card is either LOOT or TECHNIQUE (tags):
//   - loot      — unique things found in the Zone. Typically stronger, but they
//                 irradiate you, are single-use, or both.
//   - technique — learned skills. Cleaner, weaker, no strings attached.
//
// Conventions:
//   - Every numeric effect is a base* property read via a central helper
//     (dmgOf/blkOf/atk/blk, drawSuffix, c.rad, c.energyGain, c.heal). No literals.
//   - Weapon tag = shoot | knife | shield; everything else is an "item".
//   - "Recharging" (refills) = used once per combat, then recharges.
//   - On-play scaling (combatDamage/combatBlock) is per-combat and resets.
//   - text() lists ALL of a card's effects; cardExtras(c) appends the
//     recharge / single-use keyword. Radiation lines style themselves (±N ☢).
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

// Live countdown for "if played 3 times this combat" cards
// ([two left!/one left!/ready!]). playCountThisCombat increments BEFORE the
// action runs, so the burst fires when it reaches 3.
function burstCountdown(c) {
  const p = c.playCountThisCombat || 0;
  return p >= 2 ? "ready!" : p === 1 ? "one left!" : "two left!";
}

const cardTemplates = {
  // ================= BASIC / STARTERS (techniques) =================
  shoot: {
    templateId: "shoot", name: "Basic Shot", type: "attack", tags: ["shoot", "technique"], rarity: "starter",
    baseCost: 1, baseDamage: 5, target: "enemy",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage.`,
    action: (s, c, t) => dealDamage(s, t, dmgBase(c), { card: c }),
  },
  stab: {
    templateId: "stab", name: "Stab", type: "attack", tags: ["knife", "technique"], rarity: "starter",
    baseCost: 0, baseDamage: 4, target: "enemy",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage.`,
    action: (s, c, t) => dealDamage(s, t, dmgBase(c), { card: c }),
  },
  basicShield: {
    templateId: "basicShield", name: "Basic Shield", type: "skill", tags: ["shield", "technique"], rarity: "starter",
    baseCost: 1, baseBlock: 5, target: "none",
    text: (s, c) => `Gain ${blkOf(s, c)} Block.`,
    action: (s, c) => gainBlock(s, blkBase(c), { card: c }),
  },

  // ================= COMMON =================
  radioactiveRound: {
    templateId: "radioactiveRound", name: "Radioactive Round", type: "attack", tags: ["shoot", "loot", "radiation"], rarity: "common",
    baseCost: 1, baseDamage: 14, baseRad: 1, refills: true, target: "enemy",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage. Gain ${c.rad} Radiation.${cardExtras(c)}`,
    action: (s, c, t) => { dealDamage(s, t, dmgBase(c), { card: c }); gainRadiation(s, c.rad); },
  },
  antiRadInjection: {
    templateId: "antiRadInjection", name: "Anti-Rad Injection", type: "skill", tags: ["item", "loot", "medical", "consumable"], rarity: "common",
    baseCost: 1, baseRad: -6, consumedOnUse: true, target: "none",
    text: (s, c) => `Remove ${-c.rad} Radiation.${cardExtras(c)}`,
    action: (s, c) => gainRadiation(s, c.rad),
  },
  rummage: {
    templateId: "rummage", name: "Rummage", type: "skill", tags: ["item", "technique", "draw"], rarity: "common",
    baseCost: 0, handTarget: 4, target: "none",
    text: (s, c) => `Draw until you have ${c.handTarget} cards in hand.`,
    action: (s, c) => drawUpTo(s, c.handTarget),
  },
  recall: {
    templateId: "recall", name: "Recall", type: "skill", tags: ["item", "technique", "recursion"], rarity: "common",
    baseCost: 0, target: "none",
    text: () => `Return the last card you played to your hand.`,
    action: (s, c) => returnLastDiscardToHand(s, c.instanceId),
  },
  duck: {
    templateId: "duck", name: "Duck", type: "skill", tags: ["shield", "technique"], rarity: "common",
    baseCost: 0, baseBlock: 5, target: "none",
    text: (s, c) => `Gain ${blkOf(s, c)} Block.`,
    action: (s, c) => gainBlock(s, blkBase(c), { card: c }),
  },
  hunkerDown: {
    templateId: "hunkerDown", name: "Hunker Down", type: "skill", tags: ["shield", "technique", "draw"], rarity: "common",
    baseCost: 1, baseBlock: 4, baseDraw: 1, buff: 1, target: "none",
    text: (s, c) => `Gain ${blkOf(s, c)} Block. Shoot cards deal +${c.buff} this combat.${drawSuffix(s, c)}`,
    action: (s, c) => { gainBlock(s, blkBase(c), { card: c }); applyCombatMod(s, "shootDamage", c.buff, "Shoot"); },
  },
  takeCover: {
    templateId: "takeCover", name: "Take Cover", type: "skill", tags: ["shield", "technique"], rarity: "common",
    baseCost: 1, baseBlock: 4, maxHpGain: 1, refills: true, target: "none",
    text: (s, c) => `Gain ${blkOf(s, c)} Block. Gain ${c.maxHpGain} Max HP.${cardExtras(c)}`,
    action: (s, c) => { gainBlock(s, blkBase(c), { card: c }); s.player.maxHp += c.maxHpGain; s.player.hp += c.maxHpGain; },
  },
  treatedShield: {
    templateId: "treatedShield", name: "Treated Shield", type: "skill", tags: ["shield", "technique", "radiation"], rarity: "common",
    baseCost: 1, baseBlock: 5, baseRad: -1, target: "none",
    text: (s, c) => `Gain ${blkOf(s, c)} Block. Remove ${-c.rad} Radiation.`,
    action: (s, c) => { gainBlock(s, blkBase(c), { card: c }); gainRadiation(s, c.rad); },
  },
  deradiatingShield: {
    templateId: "deradiatingShield", name: "Deradiating Shield", type: "skill", tags: ["shield", "technique", "radiation"], rarity: "common",
    baseCost: 2, baseBlock: 11, baseRad: -1, target: "none",
    text: (s, c) => `Gain ${blkOf(s, c)} Block. Remove ${-c.rad} Radiation.`,
    action: (s, c) => { gainBlock(s, blkBase(c), { card: c }); gainRadiation(s, c.rad); },
  },
  heavyShield: {
    templateId: "heavyShield", name: "Heavy Shield", type: "skill", tags: ["shield", "technique"], rarity: "common",
    baseCost: 2, baseBlock: 7, baseBlockTimes: 2, target: "none",
    text: (s, c) => `Gain ${blkOf(s, c)} Block${blockTimesSuffix(s, c)}.`,
    action: (s, c) => gainBlockHits(s, blkBase(c), c),
  },
  lightMutantPelt: {
    templateId: "lightMutantPelt", name: "Light Mutant Pelt", type: "skill", tags: ["shield", "loot", "radiation"], rarity: "common",
    baseCost: 0, baseBlock: 9, baseRad: 1, target: "none",
    text: (s, c) => `Gain ${blkOf(s, c)} Block. Gain ${c.rad} Radiation.`,
    action: (s, c) => { gainBlock(s, blkBase(c), { card: c }); gainRadiation(s, c.rad); },
  },
  energyWall: {
    templateId: "energyWall", name: "Energy Wall", type: "skill", tags: ["shield", "loot", "radiation"], rarity: "common",
    baseCost: 2, baseBlock: 21, baseRad: 1, refills: true, target: "none",
    text: (s, c) => `Gain ${blkOf(s, c)} Block. Gain ${c.rad} Radiation.${cardExtras(c)}`,
    action: (s, c) => { gainBlock(s, blkBase(c), { card: c }); gainRadiation(s, c.rad); },
  },
  spikedShield: {
    templateId: "spikedShield", name: "Spiked Shield", type: "skill", tags: ["shield", "loot", "aoe", "radiation"], rarity: "common",
    baseCost: 1, baseBlock: 10, spikeDamage: 5, baseRad: 1, target: "none",
    text: (s, c) => `Gain ${blkOf(s, c)} Block. Deal ${atk(s, c.spikeDamage)} to ALL enemies. Gain ${c.rad} Radiation.`,
    action: (s, c) => { gainBlock(s, blkBase(c), { card: c }); dealDamageAll(s, c.spikeDamage); gainRadiation(s, c.rad); },
  },
  followupShot: {
    templateId: "followupShot", name: "Followup Shot", type: "attack", tags: ["shoot", "technique"], rarity: "common",
    baseCost: 1, baseDamage: 8, target: "enemy",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage. If your last card was Basic Shot, deal double.`,
    action: (s, c, t) => {
      const mult = s.currentCombat.lastCardPlayed === "shoot" ? 2 : 1;
      dealDamage(s, t, dmgBase(c) * mult, { card: c });
    },
  },
  pureAmmo: {
    templateId: "pureAmmo", name: "Pure Ammo", type: "attack", tags: ["shoot", "technique", "radiation"], rarity: "common",
    baseCost: 1, baseDamage: 7, baseRad: -1, target: "enemy",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage. Remove ${-c.rad} Radiation.`,
    action: (s, c, t) => { dealDamage(s, t, dmgBase(c), { card: c }); gainRadiation(s, c.rad); },
  },
  coverFire: {
    templateId: "coverFire", name: "Cover Fire", type: "attack", tags: ["shoot", "technique", "aoe"], rarity: "common",
    baseCost: 1, baseDamage: 5, buff: 1, target: "none",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage to ALL enemies. Shield cards gain +${c.buff} Block this combat.`,
    action: (s, c) => { dealDamageAll(s, dmgBase(c), { card: c }); applyCombatMod(s, "shieldBlock", c.buff, "Shield"); },
  },
  treatedHeavyShot: {
    templateId: "treatedHeavyShot", name: "Treated Heavy Shot", type: "attack", tags: ["shoot", "technique", "radiation"], rarity: "common",
    baseCost: 2, baseDamage: 12, baseRad: -1, target: "enemy",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage. Remove ${-c.rad} Radiation.`,
    action: (s, c, t) => { dealDamage(s, t, dmgBase(c), { card: c }); gainRadiation(s, c.rad); },
  },
  suppressingFire: {
    templateId: "suppressingFire", name: "Suppressing Fire", type: "attack", tags: ["shoot", "technique", "aoe"], rarity: "common",
    baseCost: 2, baseDamage: 10, baseBlock: 6, target: "none",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage to ALL enemies. Gain ${blkOf(s, c)} Block.`,
    action: (s, c) => { dealDamageAll(s, dmgBase(c), { card: c }); gainBlock(s, blkBase(c)); },
  },
  sprayAndPray: {
    templateId: "sprayAndPray", name: "Spray and Pray", type: "attack", tags: ["shoot", "technique", "multihit"], rarity: "common",
    baseCost: 1, baseDamage: 3, baseHits: 3, target: "enemy",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage${hitsSuffix(s, c)}.`,
    action: (s, c, t) => dealDamageHits(s, t, dmgBase(c), c),
  },
  irradiatedBullet: {
    templateId: "irradiatedBullet", name: "Irradiated Bullet", type: "attack", tags: ["shoot", "loot", "radiation"], rarity: "common",
    baseCost: 0, baseDamage: 9, baseRad: 1, target: "enemy",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage. Gain ${c.rad} Radiation.`,
    action: (s, c, t) => { dealDamage(s, t, dmgBase(c), { card: c }); gainRadiation(s, c.rad); },
  },
  irradiatedMagazine: {
    templateId: "irradiatedMagazine", name: "Irradiated Magazine", type: "attack", tags: ["shoot", "loot", "radiation"], rarity: "common",
    baseCost: 2, baseDamage: 23, baseRad: 1, target: "enemy",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage. Gain ${c.rad} Radiation.`,
    action: (s, c, t) => { dealDamage(s, t, dmgBase(c), { card: c }); gainRadiation(s, c.rad); },
  },
  swordplay: {
    templateId: "swordplay", name: "Swordplay", type: "attack", tags: ["knife", "technique"], rarity: "common",
    baseCost: 1, baseDamage: 7, buff: 1, target: "enemy",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage. Knife cards deal +${c.buff} this combat.`,
    action: (s, c, t) => { dealDamage(s, t, dmgBase(c), { card: c }); applyCombatMod(s, "knifeDamage", c.buff, "Knife"); },
  },
  crackedFang: {
    templateId: "crackedFang", name: "Cracked Fang", type: "attack", tags: ["knife", "loot", "beast", "radiation"], rarity: "common",
    baseCost: 1, baseDamage: 16, baseRad: 1, target: "enemy",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage. Gain ${c.rad} Radiation.`,
    action: (s, c, t) => { dealDamage(s, t, dmgBase(c), { card: c }); gainRadiation(s, c.rad); },
  },
  microNeedles: {
    templateId: "microNeedles", name: "Micro Needles", type: "attack", tags: ["knife", "loot", "multihit", "radiation"], rarity: "common",
    baseCost: 0, baseDamage: 4, baseHits: 3, baseRad: 1, target: "enemy",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage${hitsSuffix(s, c)}. Gain ${c.rad} Radiation.`,
    action: (s, c, t) => { dealDamageHits(s, t, dmgBase(c), c); gainRadiation(s, c.rad); },
  },
  energySlash: {
    templateId: "energySlash", name: "Energy Slash", type: "attack", tags: ["knife", "technique", "aoe", "multihit"], rarity: "common",
    baseCost: 1, baseDamage: 3, baseHits: 3, target: "none",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage to ALL enemies${hitsSuffix(s, c)}.`,
    action: (s, c) => dealDamageAllHits(s, dmgBase(c), c),
  },
  bleedingKnife: {
    templateId: "bleedingKnife", name: "Bleeding Knife", type: "attack", tags: ["knife", "loot", "multihit", "scaling", "radiation"], rarity: "common",
    baseCost: 1, baseDamage: 5, baseHits: 2, scaleDamage: 2, baseRad: 1, target: "enemy",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage${hitsSuffix(s, c)}. Gains ${c.scaleDamage} damage this combat when played. Gain ${c.rad} Radiation.`,
    action: (s, c, t) => { dealDamageHits(s, t, dmgBase(c), c); c.combatDamage += c.scaleDamage; gainRadiation(s, c.rad); },
  },
  disablingStrike: {
    templateId: "disablingStrike", name: "Disabling Strike", type: "attack", tags: ["knife", "technique", "debuff"], rarity: "common",
    baseCost: 1, baseDamage: 7, weaken: 1, refills: true, target: "enemy",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage. Target deals ${c.weaken} less damage this combat.${cardExtras(c)}`,
    action: (s, c, t) => { dealDamage(s, t, dmgBase(c), { card: c }); if (t) t.strength -= c.weaken; },
  },

  // ================= UNCOMMON =================
  trackerBullets: {
    templateId: "trackerBullets", name: "Tracker Bullets", type: "attack", tags: ["shoot", "loot", "scaling", "radiation"], rarity: "uncommon",
    baseCost: 1, baseDamage: 12, scaleDamage: 6, baseRad: 1, target: "enemy",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage. Increase this card's damage by ${c.scaleDamage} this combat. Gain ${c.rad} Radiation.`,
    action: (s, c, t) => { dealDamage(s, t, dmgBase(c), { card: c }); c.combatDamage += c.scaleDamage; gainRadiation(s, c.rad); },
  },
  heavyBuckshot: {
    templateId: "heavyBuckshot", name: "Heavy Buckshot", type: "attack", tags: ["shoot", "technique", "aoe"], rarity: "uncommon",
    baseCost: 2, baseDamage: 14, buff: 1, target: "none",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage to ALL enemies. Shield cards gain +${c.buff} Block this combat.`,
    action: (s, c) => { dealDamageAll(s, dmgBase(c), { card: c }); applyCombatMod(s, "shieldBlock", c.buff, "Shield"); },
  },
  burstFire: {
    templateId: "burstFire", name: "Burst Fire", type: "attack", tags: ["shoot", "technique", "multihit"], rarity: "uncommon",
    baseCost: 2, baseDamage: 4, baseHits: 5, target: "enemy",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage${hitsSuffix(s, c)}.`,
    action: (s, c, t) => dealDamageHits(s, t, dmgBase(c), c),
  },
  chargedShot: {
    templateId: "chargedShot", name: "Charged Shot", type: "attack", tags: ["shoot", "technique", "energy"], rarity: "uncommon",
    baseCost: 0, costDisplay: "X", baseDamage: 8, target: "enemy",
    text: (s, c) => `Spend all Energy. Deal ${dmgOf(s, c)} damage once per Energy spent [${dmgOf(s, c) * s.player.energy} total].`,
    action: (s, c, t) => { const e = s.player.energy; s.player.energy = 0; for (let i = 0; i < e; i++) dealDamage(s, t, dmgBase(c), { card: c }); },
  },
  treatedBullets: {
    templateId: "treatedBullets", name: "Treated Bullets", type: "attack", tags: ["shoot", "technique", "radiation"], rarity: "uncommon",
    baseCost: 2, baseDamage: 16, baseRad: -1, target: "enemy",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage. Remove ${-c.rad} Radiation.`,
    action: (s, c, t) => { dealDamage(s, t, dmgBase(c), { card: c }); gainRadiation(s, c.rad); },
  },
  bayonetCharge: {
    templateId: "bayonetCharge", name: "Bayonet Charge", type: "attack", tags: ["shoot", "technique"], rarity: "uncommon",
    baseCost: 1, baseDamage: 10, comboBlock: 10, target: "enemy",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage. If you played a Knife this turn, gain ${c.comboBlock} Block.`,
    action: (s, c, t) => {
      dealDamage(s, t, dmgBase(c), { card: c });
      const playedKnife = s.currentCombat.cardsPlayedThisTurn.some((pc) => pc !== c && pc.tags && pc.tags.includes("knife"));
      if (playedKnife) gainBlock(s, c.comboBlock);
    },
  },
  pointBlank: {
    templateId: "pointBlank", name: "Point Blank", type: "attack", tags: ["shoot", "technique"], rarity: "uncommon",
    baseCost: 1, baseDamage: 9, bonusDamage: 12, target: "enemy",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage. If this is the only card in hand, deal ${c.bonusDamage} extra.`,
    action: (s, c, t) => dealDamage(s, t, dmgBase(c) + (s.player.hand.length === 0 ? c.bonusDamage : 0), { card: c }),
  },
  goldenGun: {
    templateId: "goldenGun", name: "Golden Gun", type: "attack", tags: ["shoot", "loot", "economy", "radiation"], rarity: "uncommon",
    baseCost: 1, baseDamage: 9, per: 1, baseRad: 1, target: "enemy",
    text: (s, c) => `Deal ${c.damage} damage +1 per gold [${atk(s, dmgBase(c) + Math.floor(s.player.credits / c.per), c)}]. Gain ${c.rad} Radiation.`,
    action: (s, c, t) => { dealDamage(s, t, dmgBase(c) + Math.floor(s.player.credits / c.per), { card: c }); gainRadiation(s, c.rad); },
  },
  scrapCannon: {
    templateId: "scrapCannon", name: "Scrap Cannon", type: "attack", tags: ["shoot", "loot", "radiation"], rarity: "uncommon",
    baseCost: 3, baseDamage: 33, baseRad: 2, refills: true, target: "enemy",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage. Gain ${c.rad} Radiation.${cardExtras(c)}`,
    action: (s, c, t) => { dealDamage(s, t, dmgBase(c), { card: c }); gainRadiation(s, c.rad); },
  },
  unstableBullets: {
    templateId: "unstableBullets", name: "Unstable Bullets", type: "attack", tags: ["shoot", "loot", "radiation", "scaling"], rarity: "uncommon",
    baseCost: 1, baseDamage: 11, baseRad: 1, target: "enemy",
    text: (s, c) => {
      const m = Math.pow(2, c.playCountThisCombat);
      return `Deal ${atk(s, dmgBase(c) * m, c)} damage. Gain ${c.rad * m} Radiation. Doubles each replay this combat.`;
    },
    action: (s, c, t) => {
      const m = Math.pow(2, Math.max(0, c.playCountThisCombat - 1));
      dealDamage(s, t, dmgBase(c) * m, { card: c });
      gainRadiation(s, c.rad * m);
    },
  },
  gunHoloshield: {
    templateId: "gunHoloshield", name: "Gun Holoshield", type: "attack", tags: ["shoot", "loot", "radiation"], rarity: "uncommon",
    baseCost: 1, baseDamage: 9, autoBlockGain: 2, baseRad: 1, target: "enemy",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage. Gain ${c.autoBlockGain} Auto-Block. Gain ${c.rad} Radiation.`,
    action: (s, c, t) => { dealDamage(s, t, dmgBase(c), { card: c }); applyCombatMod(s, "autoBlock", c.autoBlockGain); gainRadiation(s, c.rad); },
  },
  pressurize: {
    templateId: "pressurize", name: "Pressurize", type: "skill", tags: ["item", "technique", "block", "energy"], rarity: "uncommon",
    baseCost: 0, costDisplay: "X", perEnergyBlock: 8, target: "none",
    text: (s, c) => `Spend all Energy. Gain ${blk(s, c.perEnergyBlock)} Block per Energy spent [${blk(s, c.perEnergyBlock) * s.player.energy} total].`,
    action: (s, c) => { const e = s.player.energy; s.player.energy = 0; for (let i = 0; i < e; i++) gainBlock(s, c.perEnergyBlock); },
  },
  meditate: {
    templateId: "meditate", name: "Meditate", type: "skill", tags: ["shield", "technique", "recursion"], rarity: "uncommon",
    baseCost: 1, baseBlock: 5, target: "none",
    text: (s, c) => `Gain ${blkOf(s, c)} Block. Return the last card you played to your hand.`,
    action: (s, c) => { gainBlock(s, blkBase(c), { card: c }); returnLastDiscardToHand(s, c.instanceId); },
  },
  heavyPack: {
    templateId: "heavyPack", name: "Heavy Pack", type: "skill", tags: ["shield", "technique", "big-deck"], rarity: "uncommon",
    baseCost: 2, target: "none",
    text: (s, c) => `Gain Block equal to your pack size [${blk(s, s.player.deck.length, c)}].`,
    action: (s, c) => gainBlock(s, s.player.deck.length, { card: c }),
  },
  thickSkin: {
    templateId: "thickSkin", name: "Thick Skin", type: "skill", tags: ["shield", "technique", "radiation"], rarity: "uncommon",
    baseCost: 1, baseBlock: 8, target: "none",
    text: (s, c) => `Gain ${c.block} Block +1 per Radiation [${blk(s, blkBase(c) + s.player.radiation, c)}].`,
    action: (s, c) => gainBlock(s, blkBase(c) + s.player.radiation, { card: c }),
  },
  shieldBash: {
    templateId: "shieldBash", name: "Shield Bash", type: "skill", tags: ["shield", "technique", "aoe"], rarity: "uncommon",
    baseCost: 2, baseBlock: 15, spikeDamage: 7, target: "none",
    text: (s, c) => `Gain ${blkOf(s, c)} Block. Deal ${atk(s, c.spikeDamage)} to ALL enemies.`,
    action: (s, c) => { gainBlock(s, blkBase(c), { card: c }); dealDamageAll(s, c.spikeDamage); },
  },
  unleashFury: {
    templateId: "unleashFury", name: "Unleash Fury", type: "skill", tags: ["shield", "technique", "aoe"], rarity: "uncommon",
    baseCost: 1, baseBlock: 7, bigDamage: 20, target: "none",
    text: (s, c) => `Gain ${blkOf(s, c)} Block. If played 3 times this combat: deal ${c.bigDamage} to ALL enemies (${burstCountdown(c)}).`,
    action: (s, c) => { gainBlock(s, blkBase(c), { card: c }); if (c.playCountThisCombat >= 3) dealDamageAll(s, c.bigDamage); },
  },
  learningShield: {
    templateId: "learningShield", name: "Learning Shield", type: "skill", tags: ["shield", "loot", "scaling", "radiation"], rarity: "common",
    baseCost: 1, baseBlock: 11, scaleBlock: 5, baseRad: 1, target: "none",
    text: (s, c) => `Gain ${blkOf(s, c)} Block. Gain ${c.scaleBlock} more Block this combat when played. Gain ${c.rad} Radiation.`,
    action: (s, c) => { gainBlock(s, blkBase(c), { card: c }); c.combatBlock += c.scaleBlock; gainRadiation(s, c.rad); },
  },
  wayOfTheShield: {
    templateId: "wayOfTheShield", name: "Way of the Shield", type: "skill", tags: ["shield", "loot", "radiation"], rarity: "uncommon",
    baseCost: 1, baseBlock: 6, buff: 1, baseRad: 1, target: "none",
    text: (s, c) => `Gain ${blkOf(s, c)} Block. Shield cards gain +${c.buff} Block this combat. Gain ${c.rad} Radiation.`,
    action: (s, c) => { gainBlock(s, blkBase(c), { card: c }); applyCombatMod(s, "shieldBlock", c.buff, "Shield"); gainRadiation(s, c.rad); },
  },
  turretWall: {
    templateId: "turretWall", name: "Turret Wall", type: "skill", tags: ["shield", "loot", "radiation"], rarity: "uncommon",
    baseCost: 2, baseBlock: 14, buff: 2, baseRad: 1, refills: true, target: "none",
    text: (s, c) => `Gain ${blkOf(s, c)} Block. Shoot cards deal +${c.buff} this combat. Gain ${c.rad} Radiation.${cardExtras(c)}`,
    action: (s, c) => { gainBlock(s, blkBase(c), { card: c }); applyCombatMod(s, "shootDamage", c.buff, "Shoot"); gainRadiation(s, c.rad); },
  },
  autoBlocker: {
    templateId: "autoBlocker", name: "Auto-Blocker", type: "skill", tags: ["shield", "loot", "radiation"], rarity: "uncommon",
    baseCost: 1, autoBlockGain: 3, baseRad: 1, target: "none",
    text: (s, c) => `Gain ${c.autoBlockGain} Auto-Block. Gain ${c.rad} Radiation.`,
    action: (s, c) => { applyCombatMod(s, "autoBlock", c.autoBlockGain); gainRadiation(s, c.rad); },
  },
  largeAutoBlocker: {
    templateId: "largeAutoBlocker", name: "Large Auto-Blocker", type: "skill", tags: ["shield", "loot", "radiation"], rarity: "uncommon",
    baseCost: 2, autoBlockGain: 5, baseRad: 1, target: "none",
    text: (s, c) => `Gain ${c.autoBlockGain} Auto-Block. Gain ${c.rad} Radiation.`,
    action: (s, c) => { applyCombatMod(s, "autoBlock", c.autoBlockGain); gainRadiation(s, c.rad); },
  },
  rustedExplosive: {
    templateId: "rustedExplosive", name: "Rusted Explosive", type: "attack", tags: ["item", "loot", "aoe"], rarity: "uncommon",
    baseCost: 1, baseDamage: 6, bigDamage: 40, refills: true, target: "none",
    text: (s, c) => `Deal ${dmgOf(s, c)} to ALL enemies. If played 3 times this combat: deal ${c.bigDamage} to ALL (${burstCountdown(c)}).${cardExtras(c)}`,
    action: (s, c) => {
      dealDamageAll(s, dmgBase(c), { card: c });
      if (c.playCountThisCombat >= 3) dealDamageAll(s, c.bigDamage);
    },
  },
  galvanizer: {
    templateId: "galvanizer", name: "Galvanizer", type: "skill", tags: ["item", "loot", "radiation", "energy"], rarity: "uncommon",
    baseCost: 0, baseRad: 2, baseEnergyGain: 2, target: "none",
    text: (s, c) => `Gain ${c.rad} Radiation. Gain ${c.energyGain} Energy.`,
    action: (s, c) => { gainRadiation(s, c.rad); gainEnergy(s, c.energyGain); },
  },
  packSorter: {
    templateId: "packSorter", name: "Pack Sorter", type: "skill", tags: ["item", "loot", "draw", "radiation"], rarity: "uncommon",
    baseCost: 0, baseDraw: 3, baseRad: 1, target: "none",
    text: (s, c) => `${drawSuffix(s, c).trim()} Gain ${c.rad} Radiation.`,
    action: (s, c) => gainRadiation(s, c.rad),
  },
  dirtyBomb: {
    templateId: "dirtyBomb", name: "Dirty Bomb", type: "attack", tags: ["item", "loot", "aoe", "radiation"], rarity: "uncommon",
    baseCost: 0, baseRad: 2, target: "none",
    text: (s, c) => `Gain ${c.rad} Radiation. Deal your Radiation to ALL enemies [${atk(s, Math.min(RAD_MAX, s.player.radiation + c.rad))}].`,
    action: (s, c) => { gainRadiation(s, c.rad); dealDamageAll(s, s.player.radiation); },
  },
  contractKiller: {
    templateId: "contractKiller", name: "Contract Killer", type: "skill", tags: ["item", "technique", "economy"], rarity: "uncommon",
    baseCost: 2, markBonus: 2, target: "enemy",
    text: (s, c) => `Mark target. When it dies this combat, gain ${c.markBonus} gold.`,
    action: (s, c, t) => { if (t) { t.marked = true; t.markBonus = c.markBonus; } },
  },
  packSlam: {
    templateId: "packSlam", name: "Pack Slam", type: "attack", tags: ["item", "technique", "big-deck"], rarity: "uncommon",
    baseCost: 2, target: "enemy",
    text: (s, c) => `Deal damage equal to your pack size [${atk(s, s.player.deck.length, c)}].`,
    action: (s, c, t) => dealDamage(s, t, s.player.deck.length, { card: c }),
  },
  spinningSlash: {
    templateId: "spinningSlash", name: "Spinning Slash", type: "attack", tags: ["knife", "technique", "aoe"], rarity: "uncommon",
    baseCost: 1, baseDamage: 11, buff: 4, target: "none",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage to ALL enemies. Knife cards deal +${c.buff} this combat.`,
    action: (s, c) => { dealDamageAll(s, dmgBase(c), { card: c }); applyCombatMod(s, "knifeDamage", c.buff, "Knife"); },
  },
  goldenKnife: {
    templateId: "goldenKnife", name: "Golden Knife", type: "attack", tags: ["knife", "loot", "economy", "radiation"], rarity: "uncommon",
    baseCost: 1, baseDamage: 8, per: 1, baseRad: 1, target: "enemy",
    text: (s, c) => `Deal ${c.damage} damage +1 per gold [${atk(s, dmgBase(c) + Math.floor(s.player.credits / c.per), c)}]. Gain ${c.rad} Radiation.`,
    action: (s, c, t) => { dealDamage(s, t, dmgBase(c) + Math.floor(s.player.credits / c.per), { card: c }); gainRadiation(s, c.rad); },
  },
  limbRemover: {
    templateId: "limbRemover", name: "Limb Remover", type: "attack", tags: ["knife", "loot", "debuff", "radiation"], rarity: "uncommon",
    baseCost: 1, baseDamage: 6, weaken: 1, baseRad: 1, target: "enemy",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage. Target deals ${c.weaken} less damage this combat. Gain ${c.rad} Radiation.`,
    action: (s, c, t) => { dealDamage(s, t, dmgBase(c), { card: c }); if (t) t.strength -= c.weaken; gainRadiation(s, c.rad); },
  },
  knifeOnARope: {
    templateId: "knifeOnARope", name: "Knife on a Rope", type: "attack", tags: ["knife", "technique", "aoe", "multihit"], rarity: "uncommon",
    baseCost: 2, baseDamage: 11, baseHits: 2, target: "none",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage to ALL enemies${hitsSuffix(s, c)}.`,
    action: (s, c) => dealDamageAllHits(s, dmgBase(c), c),
  },

  // ================= RARE (all loot) =================
  largeGunHoloshield: {
    templateId: "largeGunHoloshield", name: "Large Gun Holoshield", type: "attack", tags: ["shoot", "loot", "radiation"], rarity: "rare",
    baseCost: 2, baseDamage: 12, autoBlockGain: 3, baseRad: 2, target: "enemy",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage. Gain ${c.autoBlockGain} Auto-Block. Gain ${c.rad} Radiation.`,
    action: (s, c, t) => { dealDamage(s, t, dmgBase(c), { card: c }); applyCombatMod(s, "autoBlock", c.autoBlockGain); gainRadiation(s, c.rad); },
  },
  aimedShot: {
    templateId: "aimedShot", name: "Aimed Shot", type: "attack", tags: ["shoot", "loot", "scaling", "radiation"], rarity: "rare",
    baseCost: 2, baseDamage: 18, scaleDamage: 12, baseRad: 1, target: "enemy",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage. Increase this card's damage by ${c.scaleDamage} this combat. Gain ${c.rad} Radiation.`,
    action: (s, c, t) => { dealDamage(s, t, dmgBase(c), { card: c }); c.combatDamage += c.scaleDamage; gainRadiation(s, c.rad); },
  },
  microNuke: {
    templateId: "microNuke", name: "Micro Nuke", type: "attack", tags: ["shoot", "loot", "radiation"], rarity: "rare",
    baseCost: 3, baseDamage: 44, baseRad: 4, target: "enemy",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage. Gain ${c.rad} Radiation.`,
    action: (s, c, t) => { dealDamage(s, t, dmgBase(c), { card: c }); gainRadiation(s, c.rad); },
  },
  gravityGun: {
    templateId: "gravityGun", name: "Gravity Gun", type: "attack", tags: ["shoot", "loot", "loot-payoff", "radiation"], rarity: "rare",
    baseCost: 2, per: 4, baseRad: 2, target: "enemy",
    text: (s, c) => `Deal ${c.per} damage per Loot card in your deck [${atk(s, c.per * lootInDeck(s), c)}]. Gain ${c.rad} Radiation.`,
    action: (s, c, t) => { dealDamage(s, t, c.per * lootInDeck(s), { card: c }); gainRadiation(s, c.rad); },
  },
  amplifiedEnergyShot: {
    templateId: "amplifiedEnergyShot", name: "Amplified Energy Shot", type: "attack", tags: ["shoot", "loot", "scaling", "radiation"], rarity: "rare",
    baseCost: 1, baseDamage: 7, scaleDamage: 3, baseRad: 1, refills: true, target: "enemy",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage. This card permanently gains ${c.scaleDamage} damage. Gain ${c.rad} Radiation.${cardExtras(c)}`,
    action: (s, c, t) => { dealDamage(s, t, dmgBase(c), { card: c }); c.damage += c.scaleDamage; gainRadiation(s, c.rad); },
  },
  amplifiedEnergyBlast: {
    templateId: "amplifiedEnergyBlast", name: "Amplified Energy Blast", type: "attack", tags: ["shoot", "loot", "scaling", "radiation"], rarity: "rare",
    baseCost: 2, baseDamage: 10, scaleDamage: 5, baseRad: 1, refills: true, target: "enemy",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage. This card permanently gains ${c.scaleDamage} damage. Gain ${c.rad} Radiation.${cardExtras(c)}`,
    action: (s, c, t) => { dealDamage(s, t, dmgBase(c), { card: c }); c.damage += c.scaleDamage; gainRadiation(s, c.rad); },
  },
  imbuedRound: {
    templateId: "imbuedRound", name: "Imbued Round", type: "attack", tags: ["shoot", "loot", "consumable", "radiation"], rarity: "rare",
    baseCost: 1, baseDamage: 40, baseRad: 1, consumedOnUse: true, target: "enemy",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage. Gain ${c.rad} Radiation.${cardExtras(c)}`,
    action: (s, c, t) => { dealDamage(s, t, dmgBase(c), { card: c }); gainRadiation(s, c.rad); },
  },
  blastRound: {
    templateId: "blastRound", name: "Blast Round", type: "attack", tags: ["shoot", "loot", "aoe", "consumable", "radiation"], rarity: "rare",
    baseCost: 1, baseDamage: 30, baseRad: 1, consumedOnUse: true, target: "none",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage to ALL enemies. Gain ${c.rad} Radiation.${cardExtras(c)}`,
    action: (s, c) => { dealDamageAll(s, dmgBase(c), { card: c }); gainRadiation(s, c.rad); },
  },
  amplifiedShieldCharge: {
    templateId: "amplifiedShieldCharge", name: "Amplified Shield Charge", type: "skill", tags: ["shield", "loot", "scaling", "radiation"], rarity: "rare",
    baseCost: 1, baseBlock: 7, scaleBlock: 2, baseRad: 1, refills: true, target: "none",
    text: (s, c) => `Gain ${blkOf(s, c)} Block. This card permanently gains ${c.scaleBlock} Block. Gain ${c.rad} Radiation.${cardExtras(c)}`,
    action: (s, c) => { gainBlock(s, blkBase(c), { card: c }); c.block += c.scaleBlock; gainRadiation(s, c.rad); },
  },
  counterplate: {
    templateId: "counterplate", name: "Counterplate", type: "skill", tags: ["shield", "loot", "radiation"], rarity: "rare",
    baseCost: 1, baseBlock: 5, baseRad: 1, target: "enemy",
    text: (s, c) => `Gain ${blkOf(s, c)} Block. Enemy takes damage equal to your Block. Gain ${c.rad} Radiation.`,
    action: (s, c, t) => { gainBlock(s, blkBase(c), { card: c }); dealDamage(s, t, s.player.block); gainRadiation(s, c.rad); },
  },
  forcefield: {
    templateId: "forcefield", name: "Forcefield", type: "skill", tags: ["shield", "loot", "consumable", "radiation"], rarity: "rare",
    baseCost: 0, baseBlock: 25, baseRad: 2, consumedOnUse: true, target: "none",
    text: (s, c) => `Gain ${blkOf(s, c)} Block. Gain ${c.rad} Radiation.${cardExtras(c)}`,
    action: (s, c) => { gainBlock(s, blkBase(c), { card: c }); gainRadiation(s, c.rad); },
  },
  autoBlockPrototype: {
    templateId: "autoBlockPrototype", name: "AutoBlock Prototype", type: "skill", tags: ["shield", "loot", "consumable", "radiation"], rarity: "rare",
    baseCost: 2, autoBlockGain: 10, baseRad: 3, consumedOnUse: true, target: "none",
    text: (s, c) => `Gain ${c.autoBlockGain} Auto-Block. Gain ${c.rad} Radiation.${cardExtras(c)}`,
    action: (s, c) => { applyCombatMod(s, "autoBlock", c.autoBlockGain); gainRadiation(s, c.rad); },
  },
  plantPurifier: {
    templateId: "plantPurifier", name: "Plant Purifier", type: "skill", tags: ["shield", "loot", "consumable", "radiation"], rarity: "rare",
    baseCost: 2, baseBlock: 16, baseRad: -12, consumedOnUse: true, target: "none",
    text: (s, c) => `Gain ${blkOf(s, c)} Block. Remove ${-c.rad} Radiation.${cardExtras(c)}`,
    action: (s, c) => { gainBlock(s, blkBase(c), { card: c }); gainRadiation(s, c.rad); },
  },
  purifyingShield: {
    templateId: "purifyingShield", name: "Purifying Shield", type: "skill", tags: ["shield", "loot", "radiation"], rarity: "rare",
    baseCost: 3, baseBlock: 22, baseRad: -3, refills: true, target: "none",
    text: (s, c) => `Gain ${blkOf(s, c)} Block. Remove ${-c.rad} Radiation.${cardExtras(c)}`,
    action: (s, c) => { gainBlock(s, blkBase(c), { card: c }); gainRadiation(s, c.rad); },
  },
  aimStims: {
    templateId: "aimStims", name: "Aim Stims", type: "skill", tags: ["item", "loot", "radiation", "equipment"], rarity: "rare",
    baseCost: 1, baseRad: 2, buff: 4, target: "none",
    text: (s, c) => `Shoot cards deal +${c.buff} this combat. Gain ${c.rad} Radiation.`,
    action: (s, c) => { applyCombatMod(s, "shootDamage", c.buff, "Shoot"); gainRadiation(s, c.rad); },
  },
  combatStims: {
    templateId: "combatStims", name: "Combat Stims", type: "skill", tags: ["item", "loot", "radiation", "equipment"], rarity: "rare",
    baseCost: 1, baseRad: 2, buff: 6, target: "none",
    text: (s, c) => `Knife cards deal +${c.buff} this combat. Gain ${c.rad} Radiation.`,
    action: (s, c) => { applyCombatMod(s, "knifeDamage", c.buff, "Knife"); gainRadiation(s, c.rad); },
  },
  skinStims: {
    templateId: "skinStims", name: "Skin Stims", type: "skill", tags: ["item", "loot", "radiation", "equipment"], rarity: "rare",
    baseCost: 1, baseRad: 2, buff: 3, target: "none",
    text: (s, c) => `Shield cards gain +${c.buff} Block this combat. Gain ${c.rad} Radiation.`,
    action: (s, c) => { applyCombatMod(s, "shieldBlock", c.buff, "Shield"); gainRadiation(s, c.rad); },
  },
  reactorVent: {
    templateId: "reactorVent", name: "Reactor Vent", type: "attack", tags: ["item", "loot", "aoe", "radiation"], rarity: "rare",
    baseCost: 1, drain: 5, refills: true, target: "none",
    text: (s, c) => `Remove up to ${c.drain} Radiation. Deal that much to ALL enemies [${atk(s, Math.min(c.drain, s.player.radiation))}].${cardExtras(c)}`,
    action: (s, c) => { const r = Math.min(c.drain, s.player.radiation); gainRadiation(s, -r); dealDamageAll(s, r, { card: c }); },
  },
  healingTech: {
    templateId: "healingTech", name: "Healing Tech", type: "skill", tags: ["item", "loot", "medical", "consumable", "radiation"], rarity: "rare",
    baseCost: 1, baseHeal: 30, baseRad: 3, consumedOnUse: true, target: "none",
    text: (s, c) => `Heal ${c.heal} HP. Gain ${c.rad} Radiation.${cardExtras(c)}`,
    action: (s, c) => { healPlayer(s, c.heal); gainRadiation(s, c.rad); },
  },
  deradiationGel: {
    templateId: "deradiationGel", name: "Deradiation Gel", type: "skill", tags: ["item", "loot", "medical", "consumable"], rarity: "rare",
    baseCost: 1, baseRad: -20, consumedOnUse: true, target: "none",
    text: (s, c) => `Remove ${-c.rad} Radiation.${cardExtras(c)}`,
    action: (s, c) => gainRadiation(s, c.rad),
  },
  injectorPerfectAim: {
    templateId: "injectorPerfectAim", name: "Injector: Perfect Aim", type: "skill", tags: ["item", "loot", "equipment", "consumable", "radiation"], rarity: "rare",
    baseCost: 1, baseRad: 2, perm: 1, consumedOnUse: true, target: "none",
    text: (s, c) => `Permanently increase Shoot damage by ${c.perm}. Gain ${c.rad} Radiation.${cardExtras(c)}`,
    action: (s, c) => { s.player.shootBonus += c.perm; gainRadiation(s, c.rad); },
  },
  injectorToughSkin: {
    templateId: "injectorToughSkin", name: "Injector: Tough Skin", type: "skill", tags: ["item", "loot", "equipment", "consumable", "radiation"], rarity: "rare",
    baseCost: 1, baseRad: 2, perm: 1, consumedOnUse: true, target: "none",
    text: (s, c) => `Permanently increase Shield block by ${c.perm}. Gain ${c.rad} Radiation.${cardExtras(c)}`,
    action: (s, c) => { s.player.blockBonus += c.perm; gainRadiation(s, c.rad); },
  },
  injectorReflexes: {
    templateId: "injectorReflexes", name: "Injector: Reflexes", type: "skill", tags: ["item", "loot", "equipment", "consumable", "radiation"], rarity: "rare",
    baseCost: 1, baseRad: 2, perm: 3, consumedOnUse: true, target: "none",
    text: (s, c) => `Permanently increase Knife damage by ${c.perm}. Gain ${c.rad} Radiation.${cardExtras(c)}`,
    action: (s, c) => { s.player.knifeBonus += c.perm; gainRadiation(s, c.rad); },
  },

  // ================= REWARD-ONLY =================
  // Dropped by the post-combat "Salvage found" reward (never in loot rolls or
  // trader stock — rarity "special" keeps it out of both pools). A money card:
  // cycles itself in combat, sells big at a trader.
  valuableSalvage: {
    templateId: "valuableSalvage", name: "Valuable Salvage", type: "skill", tags: ["item", "loot", "salvage", "draw"], rarity: "special",
    baseCost: 1, baseDraw: 1, sellValue: 10, canSell: true, target: "none",
    text: (s, c) => `${drawSuffix(s, c).trim()} Sells for ${c.sellValue} gold.`,
    action: () => {},
  },

  // ================= ENEMY-INFLICTED (added to your deck; use leaf art) =========
  junk: {
    templateId: "junk", name: "Junk", type: "status", tags: ["junk", "curse"], rarity: "special",
    baseCost: 1, canSell: false, target: "none", art: "leaf",
    text: () => `Worthless salvage. Does nothing. Remove it at a Mechanic.`,
    action: () => {},
  },
  nettle: {
    templateId: "nettle", name: "Nettle", type: "attack", tags: ["nettle", "plant"], rarity: "special",
    baseCost: 0, baseDamage: 5, canSell: false, consumedOnUse: true, target: "enemy", art: "leaf",
    text: (s, c) => `Deal ${dmgOf(s, c)} damage. Lose 1 HP.${cardExtras(c)}`,
    action: (s, c, t) => { dealDamage(s, t, dmgBase(c)); dealSelfDamage(s, 1); },
  },
  antiRadSpore: {
    templateId: "antiRadSpore", name: "Anti-Rad Spore", type: "skill", tags: ["spore", "medical", "consumable"], rarity: "special",
    baseCost: 1, baseRad: -3, canSell: false, consumedOnUse: true, target: "none", art: "leaf",
    text: (s, c) => `Remove ${-c.rad} Radiation.${cardExtras(c)}`,
    action: (s, c) => gainRadiation(s, c.rad),
  },
  // Parasitic Fern: cost 1, draw 2, single-use.
  questingSpore: {
    templateId: "questingSpore", name: "Questing Spore", type: "skill", tags: ["quest", "plant"], rarity: "special",
    baseCost: 1, baseDraw: 2, canSell: false, consumedOnUse: true, target: "none", art: "leaf",
    text: (s, c) => `${drawSuffix(s, c).trim()}${cardExtras(c)}`,
    action: () => {},
  },
  // Fauna Monstrosity: cost 2, gain 2 Block.
  nectarBulb: {
    templateId: "nectarBulb", name: "Nectar Bulb", type: "skill", tags: ["plant", "block"], rarity: "special",
    baseCost: 2, baseBlock: 2, canSell: false, target: "none", art: "leaf",
    text: (s, c) => `Gain ${blkOf(s, c)} Block.`,
    action: (s, c) => gainBlock(s, blkBase(c)),
  },
};

// Effective (possibly dynamic) energy cost, including artifact discounts.
function effectiveCost(s, card) {
  let cost = card.dynamicCost ? card.dynamicCost(s, card) : card.cost;
  // Shield Surge relic: basic Shield cards cost 0.
  if (card.templateId === "basicShield" && typeof hasArtifact === "function" && hasArtifact("shieldSurge")) {
    return 0;
  }
  return cost;
}

// Sell value derived from rarity when a card doesn't specify one.
function sellByRarity(r) {
  return { starter: 0, common: 1, uncommon: 4, rare: 10, special: 0 }[r] ?? 1;
}

// Clone a template into a live instance.
function makeCard(templateId) {
  const t = cardTemplates[templateId];
  if (!t) throw new Error(`Unknown card template: ${templateId}`);
  return {
    ...t,
    instanceId: nextId("card"),
    cost: t.baseCost ?? 0,
    damage: t.baseDamage ?? 0,
    block: t.baseBlock ?? 0,
    heal: t.baseHeal ?? 0,
    healOnPlay: t.baseHealOnPlay ?? 0, // heal-on-play rider (added by events)
    hits: t.baseHits ?? 1,
    blockTimes: t.baseBlockTimes ?? 1,
    draw: t.baseDraw ?? 0,
    energyGain: t.baseEnergyGain ?? 0,
    rad: t.baseRad ?? 0,
    combatDamage: 0, // per-combat scaling, reset at combat end
    combatBlock: 0,
    captureThreshold: t.captureThreshold ?? 0,
    sellValue: t.sellValue ?? sellByRarity(t.rarity),
    canSell: t.canSell ?? (t.rarity !== "starter" && t.rarity !== "special"),
    upgraded: false,
    playCountThisCombat: 0,
  };
}

// Apply the card's single upgrade (Mechanic). Sheet cards have no upgrade
// values yet, so this only does something for cards that define upgrade* fields.
function upgradeCard(card) {
  if (card.upgraded) return card;
  card.upgraded = true;
  if (card.upgradeDamage) card.damage += card.upgradeDamage;
  if (card.upgradeBlock) card.block += card.upgradeBlock;
  if (card.upgradeHeal) card.heal += card.upgradeHeal;
  if (card.upgradeHits) card.hits += card.upgradeHits;
  if (card.upgradeBlockTimes) card.blockTimes += card.upgradeBlockTimes;
  if (card.upgradeDraw) card.draw += card.upgradeDraw;
  if (card.upgradeEnergyGain) card.energyGain += card.upgradeEnergyGain;
  if (card.upgradeRad) card.rad += card.upgradeRad;
  if (card.upgradeCostReduction) card.cost = Math.max(0, card.cost - card.upgradeCostReduction);
  return card;
}

// Starting deck (teaches radiation risk + single-use + loot vs technique):
// 5 Basic Shot, 5 Basic Shield, 1 Anti-Rad Injection (single-use), and 1
// Radioactive Round (the player just happens to start with one piece of loot).
function buildStartingDeck() {
  const deck = [];
  for (let i = 0; i < 5; i++) deck.push(makeCard("shoot"));
  for (let i = 0; i < 5; i++) deck.push(makeCard("basicShield"));
  deck.push(makeCard("stab"));
  deck.push(makeCard("antiRadInjection"));
  deck.push(makeCard("radioactiveRound"));
  return deck;
}
