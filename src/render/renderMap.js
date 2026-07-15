// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// Overworld map screen: fogged grid, landmarks, player, adjacent movement.
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const TILE_GLYPH = {
  combat: "⚔", elite: "☠", boss: "★", trader: "$", doctor: "✚",
  mechanic: "⚙", extraction: "▲", loot: "◆", event: "?", empty: "",
  landmark: "◈", relic: "❖",
};

const TILE_HINT = {
  combat: "Fight", elite: "Elite", boss: "Boss", trader: "Trader",
  doctor: "Doctor", mechanic: "Mechanic", extraction: "Extraction",
  loot: "Cache", event: "Event", landmark: "Landmark", relic: "Relic", empty: "",
};

function renderMapTopBar(s) {
  const p = s.player;
  const stat = (label, value, cls) =>
    el("div", { class: ["stat", cls] }, [
      el("span", { class: "stat-label", text: label }),
      el("span", { class: "stat-value", text: String(value) }),
    ]);
  const radStat = stat("Radiation", `${p.radiation}/${RAD_MAX}`, "stat-rad");
  if (p.radiation >= 15) radStat.classList.add("rad-warning");

  return el("div", { class: "combat-topbar" }, [
    stat("HP", `${p.hp}/${p.maxHp}`, "stat-hp"),
    radStat,
    stat("Credits", p.credits, "stat-credits"),
    stat("Deck", p.deck.length, "stat-deck"),
    el("button", { class: "btn", text: "View Deck", onClick: openDeckModal }),
    el("button", { class: "btn", text: "Equipment", onClick: openEquipmentModal }),
  ]);
}

function renderMapTile(s, tile) {
  const isPlayer = tile.x === s.map.playerX && tile.y === s.map.playerY;
  const visible = tile.revealed || tile.visibleFromStart;
  const reachable = !isPlayer && isAdjacentToPlayer(tile);

  const classes = ["map-tile", `tile-${tile.type}`];
  if (!visible) classes.push("fog");
  if (isPlayer) classes.push("player");
  if (reachable) classes.push("reachable");
  if (tile.resolved) classes.push("resolved");
  // coordinate-hashed terrain tint so revealed ground looks organic
  if (visible) classes.push(`tint-${["a", "b", "c"][(tile.x * 31 + tile.y * 17) % 3]}`);
  // bright line dividing Easy (bottom) from Medium (top) enemies
  if (tile.y === MAP_MID_Y) classes.push("half-divider");

  let content = "";
  if (isPlayer) content = "◉";
  else if (visible) content = TILE_GLYPH[tile.type] || "";

  const node = el("div", {
    class: classes,
    onClick: reachable ? () => movePlayerTo(tile.id) : null,
    attrs: visible && tile.label ? { title: tile.label } : {},
  }, [el("span", { class: "tile-glyph", text: content })]);

  if (visible && (tile.type === "landmark" || tile.type === "boss") && tile.label) {
    node.append(el("span", { class: "tile-label", text: tile.label }));
  }
  return node;
}

function renderMapLegend() {
  const items = [
    ["⚔", "Fight"], ["☠", "Elite"], ["◈", "Landmark"], ["★", "Boss"],
    ["$", "Trader"], ["❖", "Relic"], ["▲", "Extraction"], ["?", "Event"],
  ];
  return el(
    "div",
    { class: "map-legend" },
    items.map(([g, label]) =>
      el("div", { class: "legend-item" }, [
        el("span", { class: "legend-glyph", text: g }),
        el("span", { text: label }),
      ])
    )
  );
}

function renderMapScreen(s) {
  const app = document.getElementById("app");
  const screen = el("div", { class: "map-screen" });

  screen.append(renderMapTopBar(s));
  const artifacts = renderArtifactStrip(s);
  if (artifacts) screen.append(artifacts);

  // hint about the tile the player is standing on / how to play
  screen.append(
    el("p", {
      class: "map-hint",
      text: "Move to an adjacent tile. Landmarks are always visible; the rest is fog until you get close.",
    })
  );

  const grid = el("div", { class: "map-grid" });
  grid.style.gridTemplateColumns = `repeat(${s.map.width}, 44px)`; // scales with Zone size
  for (let y = 0; y < s.map.height; y++) {
    for (let x = 0; x < s.map.width; x++) {
      grid.append(renderMapTile(s, s.map.tiles[keyFor(x, y)]));
    }
  }
  screen.append(grid);
  screen.append(renderMapLegend());

  app.append(screen);
}

registerRenderer(Status.MAP, renderMapScreen);
