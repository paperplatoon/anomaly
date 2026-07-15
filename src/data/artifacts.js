// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// Relics (artifacts). The player collects many but equips ≤5 (equippedArtifacts);
// only equipped relics are active. Acquired at landmark bosses, relic tiles, and
// elite drops.
//
// Two implementation styles:
//   - Stat relics: apply(s) bumps a player.* property. These are NOT permanent —
//     recomputeRelicStats() zeroes the stats and re-applies every EQUIPPED relic
//     whenever the equipped set changes, so they stack and reverse cleanly.
//   - Trigger relics: event hooks fired (for equipped relics only) by
//     fireArtifacts — onPlayCard(s, card), onGainRadiation(s, n), onStartTurn(s),
//     onRemoveSingleUse(s, card), onCombatStart/End(s), onGainBlock(s, amount).
// A few (Dud Ammo, Shield Surge, Mass Converter) are read inline via hasArtifact
// (which checks the equipped set) in resolvePlayCardState / effectiveCost.
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const artifactDefs = {
  // ----- stat relics (apply() bumps a player property; recomputed on equip) -----
  overclockedBattery: {
    id: "overclockedBattery", name: "Overclocked Battery", rarity: "rare",
    description: "Gain 1 extra Energy per turn. +4 Radiation after each combat.",
    apply: (s) => { s.player.energyPerTurn += 1; s.player.postCombatRadGain += 4; },
  },
  ritualTalisman: {
    id: "ritualTalisman", name: "Ritual Talisman", rarity: "rare",
    description: "Gain 1 extra Energy per turn. Lose 4 HP after each combat.",
    apply: (s) => { s.player.energyPerTurn += 1; s.player.postCombatHpLoss += 4; },
  },
  spareBattery: {
    id: "spareBattery", name: "Spare Battery", rarity: "uncommon",
    description: "Gain 2 extra Energy on turn 1.",
    apply: (s) => { s.player.turn1Energy += 2; },
  },
  stoneFlower: {
    id: "stoneFlower", name: "Stone Flower", rarity: "uncommon",
    description: "Heal 11 HP after each combat. Lose 1 Energy on turn 1.",
    apply: (s) => { s.player.postCombatHeal += 11; s.player.turn1Energy -= 1; },
  },
  mutationResistance: {
    id: "mutationResistance", name: "Mutation Resistance", rarity: "common",
    description: "Remove 4 Radiation after each combat.",
    apply: (s) => { s.player.postCombatRadRemove += 4; },
  },
  protectiveAmulet: {
    id: "protectiveAmulet", name: "Protective Amulet", rarity: "common",
    description: "Heal 3 HP and remove 3 Radiation after each combat.",
    apply: (s) => { s.player.postCombatHeal += 3; s.player.postCombatRadRemove += 3; },
  },
  radioactiveMagnet: {
    id: "radioactiveMagnet", name: "Radioactive Magnet", rarity: "rare",
    description: "Draw 1 extra card per turn. +3 Radiation after each combat.",
    apply: (s) => { s.player.extraDrawPerTurn += 1; s.player.postCombatRadGain += 3; },
  },
  radiationSuit: {
    id: "radiationSuit", name: "Radiation Suit", rarity: "common",
    description: "When you gain Radiation, gain 2 less.",
    apply: (s) => { s.player.radReduction += 2; },
  },

  // ----- trigger relics (event hooks) -----
  autoTargeting: {
    id: "autoTargeting", name: "Auto Targeting", rarity: "uncommon",
    description: "Whenever you play a gun card, it gains 2 damage this combat.",
    onPlayCard: (s, card) => { if (card.tags && card.tags.includes("shoot")) card.combatDamage += 2; },
  },
  shieldTotem: {
    id: "shieldTotem", name: "Shield Totem", rarity: "uncommon",
    description: "Whenever you play a Shield card, it gains 1 Block this combat.",
    onPlayCard: (s, card) => { if (card.tags && card.tags.includes("shield")) card.combatBlock += 1; },
  },
  bulletShield: {
    id: "bulletShield", name: "Bullet Shield", rarity: "uncommon",
    description: "Whenever you play a gun card, gain 2 Block.",
    onPlayCard: (s, card) => { if (card.tags && card.tags.includes("shoot")) gainBlock(s, 2); },
  },
  bloodTransfusion: {
    id: "bloodTransfusion", name: "Blood Transfusion", rarity: "common",
    description: "Whenever you play a Knife card, heal 2 HP.",
    onPlayCard: (s, card) => { if (card.tags && card.tags.includes("knife")) healPlayer(s, 2); },
  },
  scrappersInstinct: {
    id: "scrappersInstinct", name: "Scrapper's Instinct", rarity: "common",
    description: "Whenever you play a Loot card, gain 2 Block.",
    onPlayCard: (s, card) => { if (card.tags && card.tags.includes("loot")) gainBlock(s, 2); },
  },
  mutantsBlood: {
    id: "mutantsBlood", name: "Mutant's Blood", rarity: "uncommon",
    description: "Whenever you gain Radiation, heal 2 HP.",
    onGainRadiation: (s, n) => { if (n > 0) healPlayer(s, 2); },
  },
  composting: {
    id: "composting", name: "Composting", rarity: "common",
    description: "Whenever you remove a single-use card, heal 2 HP.",
    onRemoveSingleUse: (s) => healPlayer(s, 2),
  },
  resourceful: {
    id: "resourceful", name: "Resourceful", rarity: "common",
    description: "Whenever you remove a single-use card, Shield cards gain +1 Block this combat.",
    onRemoveSingleUse: (s) => { if (s.currentCombat) s.currentCombat.mods.shieldBlock += 1; },
  },
  flickeringShield: {
    id: "flickeringShield", name: "Flickering Shield", rarity: "common",
    description: "Every other turn, gain 8 Block.",
    onStartTurn: (s) => { if (s.currentCombat.turnNumber % 2 === 0) gainBlock(s, 8); },
  },

  // ----- special relics (read inline where they apply) -----
  dudAmmo: {
    id: "dudAmmo", name: "Dud Ammo", rarity: "uncommon",
    description: "The first Shoot card you play each combat deals no damage and is permanently removed.",
    // handled in resolvePlayCardState (combat.dudUsed)
  },
  shieldSurge: {
    id: "shieldSurge", name: "Shield Surge", rarity: "common",
    description: "Basic Shield cards cost 0 Energy.",
    // handled in effectiveCost
  },
  massConverter: {
    id: "massConverter", name: "Mass Converter", rarity: "rare",
    description: "Recharge cards recharge immediately (returned to your pile this combat).",
    // handled in card destination
  },
};
