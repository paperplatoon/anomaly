// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// Relic (artifact) ownership + hook firing. The player OWNS any number of relics
// (player.artifacts) but only the EQUIPPED ones (player.equippedArtifacts, ≤5)
// are active: hooks fire for them, and their stat effects are recomputed from
// the equipped set. Swap them on the equipment screen.
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const MAX_EQUIPPED_ARTIFACTS = 5;

// True only if the relic is currently EQUIPPED (active). Inline relic checks
// (Dud Ammo / Shield Surge / Mass Converter) rely on this.
function hasArtifact(id) {
  return state.player.equippedArtifacts.includes(id);
}

// Fire a hook for every EQUIPPED relic that defines it.
function fireArtifacts(hook, s, ...args) {
  s.player.equippedArtifacts.forEach((id) => {
    const def = artifactDefs[id];
    if (def && typeof def[hook] === "function") def[hook](s, ...args);
  });
}

// Rebuild the relic-derived player stats from scratch: zero them, then re-apply
// each equipped stat relic's apply(). Called whenever the equipped set changes.
// (These stats are relic-only writers, so a clean zero-and-reapply is safe.)
function recomputeRelicStats(s) {
  const p = s.player;
  p.energyPerTurn = 0; p.turn1Energy = 0; p.extraDrawPerTurn = 0; p.radReduction = 0;
  p.postCombatHeal = 0; p.postCombatRadRemove = 0; p.postCombatRadGain = 0; p.postCombatHpLoss = 0;
  p.equippedArtifacts.forEach((id) => {
    const def = artifactDefs[id];
    if (def && typeof def.apply === "function") def.apply(s);
  });
}

// Equip an owned relic (up to the cap). No-op if unowned, already equipped, or full.
function equipArtifact(s, id) {
  const p = s.player;
  if (!p.artifacts.includes(id)) return false;
  if (p.equippedArtifacts.includes(id)) return false;
  if (p.equippedArtifacts.length >= MAX_EQUIPPED_ARTIFACTS) return false;
  p.equippedArtifacts.push(id);
  recomputeRelicStats(s);
  return true;
}

// Unequip a relic (keeps it owned).
function unequipArtifact(s, id) {
  const i = s.player.equippedArtifacts.indexOf(id);
  if (i < 0) return;
  s.player.equippedArtifacts.splice(i, 1);
  recomputeRelicStats(s);
}

// Give the player a relic. Adds it to the collection and auto-equips it if there
// is a free slot. Returns its def (or null if already owned / unknown).
function grantArtifact(s, id) {
  if (!artifactDefs[id] || s.player.artifacts.includes(id)) return null;
  s.player.artifacts.push(id);
  if (s.player.equippedArtifacts.length < MAX_EQUIPPED_ARTIFACTS) {
    s.player.equippedArtifacts.push(id);
    recomputeRelicStats(s);
  }
  return artifactDefs[id];
}

// Grant a random not-yet-owned relic; returns its def (or null if all owned).
function grantRandomArtifact(s) {
  const owned = new Set(s.player.artifacts);
  const pool = Object.keys(artifactDefs).filter((id) => !owned.has(id));
  if (!pool.length) return null;
  return grantArtifact(s, pool[randInt(0, pool.length - 1)]);
}
