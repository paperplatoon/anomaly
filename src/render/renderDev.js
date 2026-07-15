// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// DEV-ONLY Card Gallery. Shows every card in the game grouped by rarity, each
// with its face and a line of its editable BASE values — the exact knobs you
// tweak in data/cards.js. Not part of the shipping game loop.
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const GALLERY_RARITY_ORDER = ["starter", "common", "uncommon", "rare", "special"];

// Build a compact "base values" line from a template — the tunable knobs.
function galleryBaseLine(t) {
  const parts = [];
  const cost = t.costDisplay != null ? t.costDisplay : t.baseCost ?? 0;
  parts.push(`cost ${cost}`);

  const withUp = (label, base, up) => {
    if (base == null) return;
    parts.push(up ? `${label} ${base} (+${up})` : `${label} ${base}`);
  };
  withUp("dmg", t.baseDamage, t.upgradeDamage);
  if (t.bigDamage != null) parts.push(`bigDmg ${t.bigDamage}`);
  if (t.hits != null) parts.push(`hits ${t.hits}`);
  withUp("blk", t.baseBlock, t.upgradeBlock);
  if (t.altBlock != null) parts.push(`altBlk ${t.altBlock}`);
  withUp("heal", t.baseHeal, t.upgradeHeal);
  withUp("str", t.strength, t.upgradeStrength);
  if (t.per != null) parts.push(`per ${t.per}`);
  if (t.threshold != null) parts.push(`thresh ${t.threshold}`);
  if (t.drain != null) parts.push(`drain ${t.drain}`);
  if (t.selfDamage != null) parts.push(`selfDmg ${t.selfDamage}`);
  if (t.credits != null) parts.push(`credits ${t.credits}`);
  if (t.bonus != null) parts.push(`bonus ${t.bonus}`);
  if (t.markBonus != null) parts.push(`mark ${t.markBonus}`);
  if (t.captureThreshold != null) parts.push(`capture ${t.captureThreshold}`);
  parts.push(`sell ${t.sellValue ?? 0}`);
  return parts.join(" · ");
}

function galleryCardBlock(s, templateId) {
  const t = cardTemplates[templateId];
  const card = makeCard(templateId);

  return el("div", { class: "gallery-card" }, [
    renderCardFace(s, card, { showSell: false }),
    el("div", { class: "gallery-meta" }, [
      el("div", { class: "gallery-tags", text: (t.tags || []).join(", ") }),
      el("div", { class: "gallery-base", text: galleryBaseLine(t) }),
    ]),
  ]);
}

function renderCardGallery(s) {
  const app = document.getElementById("app");
  const ids = Object.keys(cardTemplates);

  const screen = el("div", { class: "gallery-screen" });
  screen.append(
    el("div", { class: "gallery-header" }, [
      el("h2", { class: "service-title", text: `Card Gallery — ${ids.length} cards` }),
      el("p", {
        class: "muted",
        text: "Dev view. Base values shown are the fields to edit in data/cards.js. Grouped by rarity.",
      }),
      el("button", { class: ["btn", "btn-primary"], text: "Back to Title", onClick: () => goToStatus(Status.TITLE) }),
    ])
  );

  // group by rarity in a fixed order, unknown rarities last
  const groups = {};
  ids.forEach((id) => {
    const r = cardTemplates[id].rarity || "other";
    (groups[r] = groups[r] || []).push(id);
  });
  const order = [...GALLERY_RARITY_ORDER, ...Object.keys(groups).filter((r) => !GALLERY_RARITY_ORDER.includes(r))];

  order.forEach((rarity) => {
    const group = groups[rarity];
    if (!group || !group.length) return;
    screen.append(el("h3", { class: "gallery-rarity", text: `${rarity} (${group.length})` }));
    screen.append(
      el("div", { class: "gallery-grid" }, group.map((id) => galleryCardBlock(s, id)))
    );
  });

  app.append(screen);
}

registerRenderer(Status.CARD_GALLERY, renderCardGallery);

// ----- ----- ----- Enemy Bestiary (dev) ----- ----- -----

function moveLine(m) {
  // reuse combat intent text, plus the turn-grammar role
  const desc = typeof intentText === "function" ? intentText(m) : m.name;
  return `${m.name}: ${desc}${m.role ? ` [${m.role}]` : ""}`;
}

function lootLine(table) {
  if (!table || !table.length) return "—";
  return table
    .map((e) => {
      const nm = cardTemplates[e.templateId] ? cardTemplates[e.templateId].name : e.templateId;
      return `${nm} ${Math.round(e.chance * 100)}%`;
    })
    .join(", ");
}

function bestiaryCard(id) {
  const t = enemyTemplates[id];
  // a bare instance for passive-label reuse (no player scaling applied)
  const inst = { ...t };
  const passive = typeof enemyPassiveLabel === "function" ? enemyPassiveLabel(inst) : null;

  const stats = [`HP ${t.maxHp}`];
  if (t.startBlock) stats.push(`block ${t.startBlock}`);
  if (t.creditsOnKill) stats.push(`+${t.creditsOnKill}cr`);

  return el("div", { class: "bestiary-card" }, [
    el("div", { class: "bestiary-head" }, [
      el("span", { class: "bestiary-name", text: t.name }),
      el("span", { class: "bestiary-type", text: t.type }),
    ]),
    el("div", { class: "bestiary-stats", text: stats.join(" · ") }),
    passive ? el("div", { class: "bestiary-passive", text: passive }) : null,
    el(
      "div",
      { class: "bestiary-moves" },
      (t.moves && t.moves.length ? t.moves : [{ name: "Scripted (phased)" }]).map((m) =>
        el("div", {
          class: "bestiary-move",
          // dynamic-damage moves have no static number to print
          text: t.intentFn || m.dynamicDamage ? `${m.name}${m.dynamicDamage ? " (scales)" : ""}` : moveLine(m),
        })
      )
    ),
    el("div", { class: "bestiary-loot", text: `Drops: ${lootLine(t.lootTable)}` }),
    t.captureLootTable && t.captureLootTable.length
      ? el("div", { class: "bestiary-loot", text: `Capture: ${lootLine(t.captureLootTable)}` })
      : null,
  ]);
}

function renderEnemyGallery(s) {
  const app = document.getElementById("app");
  const ids = Object.keys(enemyTemplates);
  const screen = el("div", { class: "gallery-screen" });

  screen.append(
    el("div", { class: "gallery-header" }, [
      el("h2", { class: "service-title", text: `Bestiary — ${ids.length} enemies` }),
      el("p", { class: "muted", text: "Dev view. Tune HP / moves / passives / loot in data/enemies.js." }),
      el("button", { class: ["btn", "btn-primary"], text: "Back to Title", onClick: () => goToStatus(Status.TITLE) }),
    ])
  );

  screen.append(el("div", { class: "bestiary-grid" }, ids.map((id) => bestiaryCard(id))));
  app.append(screen);
}

registerRenderer(Status.ENEMY_GALLERY, renderEnemyGallery);

// ----- ----- ----- Event Gallery (dev) ----- ----- -----

const EVENT_GALLERY_ORDER = ["common", "uncommon", "rare"];

function eventGalleryLines(def) {
  const ev = {};
  if (typeof def.onOpen === "function") def.onOpen(state, ev); // sample roll for labels
  if (def.kind === "choice") {
    return def.choices(state, ev).map((c) => `• ${c.label}${c.desc ? ` — ${c.desc}` : ""}`);
  }
  if (def.kind === "selectCard") {
    return [`Select up to ${def.count} card(s) · ${def.verb}`];
  }
  return ["Applies automatically on arrival."];
}

function eventGalleryCard(def) {
  return el("div", { class: "bestiary-card" }, [
    el("div", { class: "bestiary-head" }, [
      el("span", { class: "bestiary-name", text: def.name }),
      el("span", { class: ["event-rarity", `rarity-${def.rarity}`], text: def.rarity }),
    ]),
    el("div", { class: "bestiary-passive", text: def.text }),
    el("div", { class: "bestiary-moves" }, eventGalleryLines(def).map((line) =>
      el("div", { class: "bestiary-move", text: line })
    )),
  ]);
}

function renderEventGallery(s) {
  const app = document.getElementById("app");
  const screen = el("div", { class: "gallery-screen" });

  screen.append(
    el("div", { class: "gallery-header" }, [
      el("h2", { class: "service-title", text: `Events — ${eventDefs.length}` }),
      el("p", { class: "muted", text: "Dev view. Rarity sets frequency (common > uncommon > rare). Edit data/events.js." }),
      el("button", { class: ["btn", "btn-primary"], text: "Back to Title", onClick: () => goToStatus(Status.TITLE) }),
    ])
  );

  const groups = {};
  eventDefs.forEach((d) => { (groups[d.rarity] = groups[d.rarity] || []).push(d); });
  const order = [...EVENT_GALLERY_ORDER, ...Object.keys(groups).filter((r) => !EVENT_GALLERY_ORDER.includes(r))];
  order.forEach((rarity) => {
    const group = groups[rarity];
    if (!group || !group.length) return;
    screen.append(el("h3", { class: "gallery-rarity", text: `${rarity} (${group.length})` }));
    screen.append(el("div", { class: "bestiary-grid" }, group.map((d) => eventGalleryCard(d))));
  });

  app.append(screen);
}

registerRenderer(Status.EVENT_GALLERY, renderEventGallery);
