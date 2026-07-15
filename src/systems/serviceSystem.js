// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// Trader / Doctor / Mechanic / Extraction actions (§16). Separate services so
// map planning matters — no one-stop mega shop.
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

// ----- trader ------------------------------------------------------------

// Flat small-denomination prices (buy 3/7/15 vs sell 1/4/10 keeps the spread).
function priceForCard(card) {
  if (card.rarity === "rare" || card.rarity === "special") return 15;
  if (card.rarity === "uncommon") return 7;
  return 3;
}

function generateTraderOffers() {
  // starters and "special" cards (enemy-inflicted, Valuable Salvage) never stock
  const pool = Object.values(cardTemplates).filter((t) => t.rarity !== "starter" && t.rarity !== "special");
  const byRarity = (r) => pool.filter((t) => t.rarity === r);
  const pick = (arr) => arr[randInt(0, arr.length - 1)];
  const commons = byRarity("common");
  const uncommons = byRarity("uncommon");
  const rares = byRarity("rare");

  const templates = [
    pick(commons), pick(commons),
    pick(uncommons.length ? uncommons : commons),
    pick(rares.length ? rares : uncommons),
    pick(pool),
  ];
  return templates.map((t) => {
    const card = makeCard(t.templateId);
    return { card, price: priceForCard(card) };
  });
}

function trySellCard(instanceId) {
  const p = state.player;
  const i = p.deck.findIndex((c) => c.instanceId === instanceId);
  if (i < 0) return;
  const card = p.deck[i];
  if (card.canSell === false || !(card.sellValue > 0)) return;
  p.credits += card.sellValue;
  p.deck.splice(i, 1);
  render();
}

function tryBuyOffer(index) {
  const t = state.currentTrader;
  const offer = t && t.offers[index];
  if (!offer || state.player.credits < offer.price) return;
  state.player.credits -= offer.price;
  state.player.deck.push(offer.card);
  t.offers.splice(index, 1);
  render();
}

function toggleTraderRemoveMode() {
  if (state.currentTrader) state.currentTrader.removeMode = !state.currentTrader.removeMode;
  render();
}

// Removal fee escalates each purchase this run: 8, 12, 16, …
function currentRemoveFee() {
  return 8 + 4 * (state.player.removesBought || 0);
}
function tryRemoveForFee(instanceId) {
  const p = state.player;
  const fee = currentRemoveFee();
  if (p.credits < fee) return;
  const i = p.deck.findIndex((c) => c.instanceId === instanceId);
  if (i < 0) return; // any card can be removed — thinning basics IS the point
  p.credits -= fee;
  p.removesBought = (p.removesBought || 0) + 1;
  p.deck.splice(i, 1);
  if (state.currentTrader) state.currentTrader.removeMode = false;
  render();
}

// ----- doctor (§16.3) ----------------------------------------------------

function tryDoctorHeal(amount, cost) {
  const p = state.player;
  if (p.credits < cost || p.hp >= p.maxHp) return;
  p.credits -= cost;
  p.hp = amount === "full" ? p.maxHp : Math.min(p.maxHp, p.hp + amount);
  render();
}

function tryDoctorRad(amount, cost) {
  const p = state.player;
  if (p.credits < cost || p.radiation <= 0) return;
  p.credits -= cost;
  p.radiation = amount === "all" ? 0 : Math.max(0, p.radiation - amount);
  render();
}

// ----- mechanic (§16.4) --------------------------------------------------

function canUpgrade(card) {
  return (
    !card.upgraded &&
    (card.upgradeDamage || card.upgradeBlock || card.upgradeHeal ||
      card.upgradeCaptureThreshold || card.upgradeCostReduction)
  );
}

// Mechanic removes all Junk cards for free (§16.4).
function removeAllJunk() {
  const before = state.player.deck.length;
  state.player.deck = state.player.deck.filter((c) => c.templateId !== "junk");
  if (state.player.deck.length !== before) render();
}

const UPGRADE_FEE = 8;
function tryMechanicUpgrade(instanceId) {
  const p = state.player;
  if (p.credits < UPGRADE_FEE) return;
  const card = p.deck.find((c) => c.instanceId === instanceId);
  if (!card || !canUpgrade(card)) return;
  p.credits -= UPGRADE_FEE;
  upgradeCard(card);
  render();
}

// ----- extraction (§6.1) — basic; polished in Chunk 16 -------------------

function sellableDeckValue() {
  return state.player.deck.reduce(
    (sum, c) => sum + (c.canSell !== false && c.sellValue > 0 ? c.sellValue : 0),
    0
  );
}

function extractRun() {
  const p = state.player;
  if (typeof hasArtifact === "function" && hasArtifact("safehouseKey")) {
    p.hp = Math.min(p.maxHp, p.hp + 15);
  }
  const salvage = sellableDeckValue();
  state.meta.bankedCredits += p.credits;
  state.meta.bestRunValue = Math.max(state.meta.bestRunValue || 0, p.credits);
  saveMeta();
  state.runResult = {
    outcome: "extracted",
    credits: p.credits,
    salvageValue: salvage,
    deckSize: p.deck.length,
  };
  state.status = Status.RUN_SUMMARY;
  render();
}
