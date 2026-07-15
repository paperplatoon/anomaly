// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// Reusable card-face renderer + deck-view modal. Shared by combat, loot,
// trader, mechanic, etc. so every card looks and behaves consistently.
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

// Weapon type drives card color + art. Anything not shoot/knife/shield is item.
function cardWeapon(card) {
  const t = card.tags || [];
  if (t.includes("shoot")) return "shoot";
  if (t.includes("knife")) return "knife";
  if (t.includes("shield")) return "shield";
  return "item";
}

// Rarity drives the art-panel background: white (common), silver (uncommon),
// gold (rare). Starters/status use the common look.
function cardRarityClass(card) {
  if (card.rarity === "uncommon") return "rarity-uncommon";
  if (card.rarity === "rare") return "rarity-rare";
  return "rarity-common";
}

// ----- card text: one effect per line, with styled radiation + keywords ------
// The template text() strings stay untouched (tests/keyword-matching read them
// raw); this is pure presentation. Sentences become lines; exact
// "Gain/Remove N Radiation." lines become big ±N ☢ (red = bad, green = good);
// "Recharging" renders as a dark-blue keyword.
function cardTextLines(s, card) {
  const full = card.text(s, card) + (card.healOnPlay > 0 ? ` Heal ${card.healOnPlay} HP.` : "");
  return full
    .split(/\.\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.endsWith(".") ? t : `${t}.`));
}

function renderCardTextLine(line) {
  const gain = line.match(/^Gain (\d+) Radiation\.$/i);
  const lose = line.match(/^Remove (\d+) Radiation\.$/i);
  if (gain || lose) {
    const n = (gain || lose)[1];
    return el("div", { class: ["card-line", "rad-line"] }, [
      el("span", { class: ["rad-delta", gain ? "rad-gain" : "rad-loss"], text: `${gain ? "+" : "−"}${n}` }),
      el("span", { class: "rad-icon", text: "☢" }),
    ]);
  }
  if (/^Recharging\.$/i.test(line)) {
    return el("div", { class: ["card-line", "kw-recharging"], text: "Recharging" });
  }
  return el("div", { class: "card-line", text: line });
}

// opts: { onClick, selected, disabled, showSell, costOverride }
// Layout mirrors the design mockup: pink cost circle (top-left), title, a
// rarity-tinted art panel with the weapon/item image (+ a Loot tag if loot),
// then the effect text. Color + image convey weapon type & rarity visually.
function renderCardFace(s, card, opts = {}) {
  const cost = opts.costOverride != null ? opts.costOverride : effectiveCost(s, card);
  const costLabel = card.costDisplay != null ? card.costDisplay : String(cost);
  const weapon = cardWeapon(card);
  // card.art overrides the weapon image (enemy-inflicted cards use leaf.png)
  const imgName = card.art ? card.art : weapon === "shoot" ? "gun" : weapon;
  const isLoot = card.tags && card.tags.includes("loot");

  const art = el("div", { class: ["card-art", cardRarityClass(card)] }, [
    el("img", { class: "card-img", attrs: { src: `img/${imgName}.png`, alt: "", draggable: "false" } }),
    isLoot ? el("div", { class: "card-loot-tag", text: "Loot" }) : null,
  ]);

  const keywords = typeof cardKeywords === "function" ? cardKeywords(s, card) : [];
  const hasKeywords = keywords.length > 0;

  return el(
    "div",
    {
      class: [
        "card-face",
        `weapon-${weapon}`,
        opts.selected ? "card-selected" : null,
        opts.disabled ? "unaffordable" : null,
      ],
      onClick: opts.onClick || null,
      onMouseEnter: hasKeywords ? (e) => showCardTooltips(s, card, e.currentTarget) : null,
      onMouseLeave: hasKeywords ? () => hideCardTooltips() : null,
    },
    [
      el("div", { class: "card-cost", text: costLabel }),
      el("div", { class: "card-title", text: card.name + (card.upgraded ? " +" : "") }),
      art,
      el("div", { class: "card-text" }, cardTextLines(s, card).map(renderCardTextLine)),
      opts.showSell && card.sellValue > 0
        ? el("div", { class: "card-sell", text: `Sell ${card.sellValue}` })
        : null,
    ]
  );
}

// Horizontal strip of equipped artifacts (shown in top bars). Null if none.
// Hovering a chip shows a styled tooltip with exactly what the relic does.
function renderArtifactStrip(s) {
  if (!s.player.equippedArtifacts.length) return null;
  return el(
    "div",
    { class: "artifact-strip" },
    s.player.equippedArtifacts.map((id) => {
      const def = artifactDefs[id];
      return el("span", {
        class: "artifact-chip",
        text: def ? def.name : id,
        onMouseEnter: def ? (e) => showAnchoredTip(e.currentTarget, def.name, def.description) : null,
        onMouseLeave: def ? hideCardTooltips : null,
      });
    })
  );
}

// Lightweight modal overlaying the current screen (does not change status).
function openDeckModal() {
  const app = document.getElementById("app");
  const overlay = el("div", {
    class: "modal-overlay",
    onClick: (e) => {
      if (e.target === overlay) overlay.remove();
    },
  });

  const panel = el("div", { class: "modal-panel" }, [
    el("div", { class: "modal-header" }, [
      el("h3", { text: `Deck (${state.player.deck.length})` }),
      el("button", { class: "btn", text: "Close", onClick: () => overlay.remove() }),
    ]),
    el(
      "div",
      { class: "modal-cards" },
      state.player.deck.map((c) => renderCardFace(state, c, { showSell: true }))
    ),
  ]);

  overlay.append(panel);
  app.append(overlay);
}
