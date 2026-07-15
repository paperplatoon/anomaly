// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// Keyword tooltips (Slay-the-Spire style). Hovering a card shows a stack of
// rectangular tooltips pinned to the RIGHT of the screen (over whatever is
// there) — one box per keyword the card uses.
//
// A keyword matches by a card flag/tag and/or by a term in the card's rendered
// text. To add one: drop a def in KEYWORDS with a match(s, card) predicate.
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const KEYWORDS = [
  {
    id: "recharge",
    title: "Recharging",
    text: "Recharging cards can only be used once per combat. They're added back to your deck after the combat ends.",
    match: (s, c) => !!(c.refills || c.exhaustsForCombat),
  },
  {
    id: "singleUse",
    title: "Single-use",
    text: "Single-use cards are removed from your deck permanently the moment you play them.",
    match: (s, c) => !!c.consumedOnUse,
  },
  {
    id: "autoBlock",
    title: "Auto-Block",
    text: "Gain Block equal to your Auto-Block number at the end of every turn.",
    match: (s, c) => c.autoBlockGain > 0 || /auto-block/i.test(cardTextFor(s, c)),
  },
  {
    id: "capture",
    title: "Capture",
    text: "If the hit would kill the target, capture it instead for bonus gold rather than killing it.",
    match: (s, c) => (c.tags && c.tags.includes("capture")) || /capture/i.test(cardTextFor(s, c)),
  },
  {
    id: "radiation",
    title: "Radiation",
    text: "Radiation lingers on you (max 40). After each combat you lose HP equal to a third of it, and at 15+ you start combat with 1 less Energy.",
    match: (s, c) => /radiation/i.test(cardTextFor(s, c)),
  },
];

// Safe read of a card's rendered text (some callers pass template previews).
function cardTextFor(s, c) {
  try {
    return typeof c.text === "function" ? c.text(s, c) : "";
  } catch (e) {
    return "";
  }
}

// Keyword defs that apply to a card.
function cardKeywords(s, card) {
  return KEYWORDS.filter((k) => {
    try {
      return k.match(s, card);
    } catch (e) {
      return false;
    }
  });
}

// ----- hover layer --------------------------------------------------------

function keywordTooltipLayer() {
  let layer = document.getElementById("kw-tooltip-layer");
  if (!layer) {
    layer = el("div", { id: "kw-tooltip-layer", class: "kw-tooltip-layer" });
    document.body.append(layer);
  }
  return layer;
}

function hideCardTooltips() {
  const layer = document.getElementById("kw-tooltip-layer");
  if (layer) {
    layer.innerHTML = "";
    layer.style.display = "none";
  }
}

// Single tooltip box anchored BESIDE an element (status chips etc.) instead of
// pinned to the screen edge. Hidden by hideCardTooltips, same as card tips.
function showAnchoredTip(anchorEl, title, text) {
  const layer = keywordTooltipLayer();
  layer.innerHTML = "";
  layer.append(
    el("div", { class: "kw-tooltip" }, [
      el("div", { class: "kw-tooltip-title", text: title }),
      el("div", { class: "kw-tooltip-text", text }),
    ])
  );
  layer.style.display = "flex";
  const r = anchorEl.getBoundingClientRect();
  let left = r.right + 10; // prefer right of the anchor, flip left if cramped
  if (left + 260 > window.innerWidth) left = Math.max(8, r.left - 260);
  let top = r.top - 4;
  const maxTop = window.innerHeight - layer.offsetHeight - 8;
  if (top > maxTop) top = maxTop;
  if (top < 8) top = 8;
  layer.style.left = `${left}px`;
  layer.style.right = "auto";
  layer.style.top = `${top}px`;
}

// Show a card's keyword tooltips, pinned to the right and vertically aligned
// with the hovered card (clamped to the viewport).
function showCardTooltips(s, card, anchorEl) {
  const kws = cardKeywords(s, card);
  if (!kws.length) return;

  const layer = keywordTooltipLayer();
  layer.innerHTML = "";
  kws.forEach((k) => {
    layer.append(
      el("div", { class: "kw-tooltip" }, [
        el("div", { class: "kw-tooltip-title", text: k.title }),
        el("div", { class: "kw-tooltip-text", text: k.text }),
      ])
    );
  });
  layer.style.display = "flex";

  const rect = anchorEl.getBoundingClientRect();
  const margin = 16;
  layer.style.right = margin + "px";
  layer.style.left = "auto";
  let top = rect.top;
  const maxTop = window.innerHeight - layer.offsetHeight - margin;
  if (top > maxTop) top = maxTop;
  if (top < margin) top = margin;
  layer.style.top = top + "px";
}
