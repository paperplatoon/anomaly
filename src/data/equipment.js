// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// Equipment items — persistent gear the player equips in the inventory. Two
// slots: "weapon" (guns → +Shoot) and "armor" (shields → +Block). An equipped
// item's `amount` is added on top of the player's *Bonus stats by atk()/blk()
// (see equipmentSystem.equippedBonus). Items are per-run (reset each expedition).
//
// To add gear: drop a def here with { slot, stat, amount, rarity }. Events and
// rewards pull from these pools by slot + rarity, so no other wiring is needed.
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const equipmentDefs = {
  // ---- guns (weapon slot, +Shoot) ----
  makeshiftPistol: { id: "makeshiftPistol", name: "Makeshift Pistol", slot: "weapon", stat: "shoot", amount: 2, rarity: "common" },
  sawnOffShotgun: { id: "sawnOffShotgun", name: "Sawn-Off Shotgun", slot: "weapon", stat: "shoot", amount: 2, rarity: "common" },
  huntingRifle:   { id: "huntingRifle", name: "Hunting Rifle", slot: "weapon", stat: "shoot", amount: 3, rarity: "uncommon" },
  combatCarbine:  { id: "combatCarbine", name: "Combat Carbine", slot: "weapon", stat: "shoot", amount: 3, rarity: "uncommon" },
  gaussRifle:     { id: "gaussRifle", name: "Gauss Rifle", slot: "weapon", stat: "shoot", amount: 5, rarity: "rare" },
  prototypeRailgun: { id: "prototypeRailgun", name: "Prototype Railgun", slot: "weapon", stat: "shoot", amount: 5, rarity: "rare" },

  // ---- shields (armor slot, +Block) ----
  scrapVest:      { id: "scrapVest", name: "Scrap Vest", slot: "armor", stat: "block", amount: 2, rarity: "common" },
  paddedJacket:   { id: "paddedJacket", name: "Padded Jacket", slot: "armor", stat: "block", amount: 2, rarity: "common" },
  riotPlate:      { id: "riotPlate", name: "Riot Plate", slot: "armor", stat: "block", amount: 3, rarity: "uncommon" },
  kevlarRig:      { id: "kevlarRig", name: "Kevlar Rig", slot: "armor", stat: "block", amount: 3, rarity: "uncommon" },
  exoPlating:     { id: "exoPlating", name: "Exo Plating", slot: "armor", stat: "block", amount: 5, rarity: "rare" },
  nanoWeave:      { id: "nanoWeave", name: "Nano-Weave Armor", slot: "armor", stat: "block", amount: 5, rarity: "rare" },

  // ---- knives (knife slot, +Knife) ----
  rustyShiv:      { id: "rustyShiv", name: "Rusty Shiv", slot: "knife", stat: "knife", amount: 2, rarity: "common" },
  boneDagger:     { id: "boneDagger", name: "Bone Dagger", slot: "knife", stat: "knife", amount: 2, rarity: "common" },
  combatKnife:    { id: "combatKnife", name: "Combat Knife", slot: "knife", stat: "knife", amount: 4, rarity: "uncommon" },
  serratedBlade:  { id: "serratedBlade", name: "Serrated Blade", slot: "knife", stat: "knife", amount: 4, rarity: "uncommon" },
  monomolBlade:   { id: "monomolBlade", name: "Monomolecular Blade", slot: "knife", stat: "knife", amount: 7, rarity: "rare" },
  mutantFang:     { id: "mutantFang", name: "Mutant Fang", slot: "knife", stat: "knife", amount: 7, rarity: "rare" },
};

// Clone a def into a live item instance (own id so duplicates are distinct).
function makeEquipment(defId) {
  const d = equipmentDefs[defId];
  if (!d) throw new Error(`Unknown equipment def: ${defId}`);
  return { instanceId: nextId("equip"), defId: d.id, name: d.name, slot: d.slot, stat: d.stat, amount: d.amount, rarity: d.rarity };
}

// All def ids matching an optional { slot, rarity } filter.
function equipmentPool(filter = {}) {
  return Object.values(equipmentDefs)
    .filter((d) => (!filter.slot || d.slot === filter.slot) && (!filter.rarity || d.rarity === filter.rarity))
    .map((d) => d.id);
}
