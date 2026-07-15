// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// Meta persistence via localStorage (§4.1 / §21). We persist only simple data:
// preserved items as { templateId, upgraded }, banked credits, best run value,
// discovered landmarks. Never functions/instances — rehydrate via makeCard().
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const META_KEY = "projectZoneMeta";

function defaultMeta() {
  return {
    preservedItems: [],
    discoveredLandmarks: {},
    bankedCredits: 0,
    bestRunValue: 0,
  };
}

function loadMeta() {
  try {
    if (typeof localStorage === "undefined") return defaultMeta();
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return defaultMeta();
    const parsed = JSON.parse(raw);
    return { ...defaultMeta(), ...parsed };
  } catch (e) {
    return defaultMeta();
  }
}

function saveMeta() {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(META_KEY, JSON.stringify(state.meta));
  } catch (e) {
    /* ignore quota / privacy-mode errors */
  }
}

// Death: keep one carried card into the meta inventory (§6.3).
function preserveItem(instanceId) {
  const card = state.player.deck.find((c) => c.instanceId === instanceId);
  let name = null;
  if (card && card.rarity !== "starter") {
    state.meta.preservedItems.push({ templateId: card.templateId, upgraded: !!card.upgraded });
    name = card.name;
    saveMeta();
  }
  state.runResult = { outcome: "died", preserved: name };
  state.status = Status.RUN_SUMMARY;
  render();
}
