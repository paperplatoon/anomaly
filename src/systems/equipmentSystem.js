// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// Equipment inventory: equip / unequip / drop, plus the derived combat bonus
// that atk()/blk() read. Equipped item bonuses stack ON TOP of the player's
// *Bonus stats (which come from events, cards, on-defeat) — equipment never
// writes those stats, so equip/unequip is just moving items around.
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

// Combat bonus contributed by equipped gear for a given stat ("shoot"/"block"/
// "knife"). Read live by atk()/blk() — unequipping removes it automatically.
function equippedBonus(s, stat) {
  const eq = s.player.equipped;
  let n = 0;
  for (const slot in eq) {
    const it = eq[slot];
    if (it && it.stat === stat) n += it.amount;
  }
  return n;
}

// Put an item into its slot. Whatever was there goes to the stash. The item is
// removed from the stash first if it was there.
function equipItem(s, instanceId) {
  const p = s.player;
  const i = p.stash.findIndex((it) => it.instanceId === instanceId);
  if (i < 0) return;
  const item = p.stash.splice(i, 1)[0];
  const slot = item.slot;
  if (p.equipped[slot]) p.stash.push(p.equipped[slot]);
  p.equipped[slot] = item;
}

// Move an equipped item back to the stash.
function unequipSlot(s, slot) {
  const p = s.player;
  if (!p.equipped[slot]) return;
  p.stash.push(p.equipped[slot]);
  p.equipped[slot] = null;
}

// Permanently discard a stashed item.
function dropItem(s, instanceId) {
  const p = s.player;
  const i = p.stash.findIndex((it) => it.instanceId === instanceId);
  if (i >= 0) p.stash.splice(i, 1);
}

// Add an item to the inventory: auto-equip if its slot is empty, else stash it.
// Returns { item, equipped } for messaging.
function acquireEquipment(s, item) {
  const p = s.player;
  if (!p.equipped[item.slot]) {
    p.equipped[item.slot] = item;
    return { item, equipped: true };
  }
  p.stash.push(item);
  return { item, equipped: false };
}

// Make a random item matching { slot, rarity }; null if the pool is empty.
function randomEquipment(filter = {}) {
  const pool = equipmentPool(filter);
  if (!pool.length) return null;
  return makeEquipment(pool[randInt(0, pool.length - 1)]);
}
