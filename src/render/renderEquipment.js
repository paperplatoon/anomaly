// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// Equipment pop-up (modal). Opened from the map; closing returns to it. Shows
// the three gear slots (Gun / Shield / Knife) — current item highlighted, other
// owned items of that type beside it, click to equip — plus the relic collection
// (equip up to MAX_EQUIPPED_ARTIFACTS). The modal re-renders itself in place so
// equipping doesn't trigger a full app render (which would close the overlay).
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const SLOT_LABEL = { weapon: "Gun", armor: "Shield", knife: "Knife" };
const STAT_LABEL = { shoot: "Shoot", block: "Block", knife: "Knife" };
const GEAR_SLOTS = ["weapon", "armor", "knife"];
// each slot's PERMANENT training bonus (events, Lasting cards, on-defeat rewards)
const SLOT_PERM = {
  weapon: { field: "shootBonus", stat: "shoot", what: "Shoot cards deal" },
  armor: { field: "blockBonus", stat: "block", what: "Shield cards gain" },
  knife: { field: "knifeBonus", stat: "knife", what: "Knife cards deal" },
};

// One gear item chip. Equipped items unequip on click; stash items equip on
// click and carry a small drop (✕) button.
function gearChip(s, item, equipped, refresh) {
  const chip = el(
    "div",
    {
      class: ["gear-item", `rarity-${item.rarity}`, equipped ? "equipped" : null],
      attrs: { title: equipped ? "Click to unequip" : "Click to equip" },
      onClick: () => {
        if (equipped) unequipSlot(s, item.slot);
        else equipItem(s, item.instanceId);
        refresh();
      },
    },
    [
      el("span", { class: "gear-item-name", text: item.name }),
      el("span", { class: "gear-item-stat", text: `+${item.amount} ${STAT_LABEL[item.stat]}` }),
    ]
  );
  if (!equipped) {
    chip.append(
      el("button", {
        class: "gear-drop",
        text: "✕",
        attrs: { title: "Drop" },
        onClick: (e) => { e.stopPropagation(); dropItem(s, item.instanceId); refresh(); },
      })
    );
  }
  return chip;
}

function equipGearRow(s, slot, refresh) {
  const current = s.player.equipped[slot];
  const alts = s.player.stash.filter((it) => it.slot === slot);
  const items = [];
  if (current) items.push(gearChip(s, current, true, refresh));
  else items.push(el("div", { class: ["gear-item", "gear-empty"], text: "— none —" }));
  alts.forEach((it) => items.push(gearChip(s, it, false, refresh)));

  // permanent training bonus for this category (separate from equipped gear)
  const perm = SLOT_PERM[slot];
  const bonus = (s.player[perm.field] || 0);
  if (bonus) {
    items.push(el("div", {
      class: "gear-perm",
      text: `+${bonus} ${STAT_LABEL[perm.stat]} (permanent)`,
      onMouseEnter: (e) => showAnchoredTip(
        e.currentTarget,
        `Permanent ${STAT_LABEL[perm.stat]} Bonus`,
        `All your ${perm.what} +${bonus} for the rest of the run — from events, Lasting items, and other permanent upgrades. Stacks on top of your equipped ${SLOT_LABEL[slot].toLowerCase()}.`
      ),
      onMouseLeave: hideCardTooltips,
    }));
  }

  return el("div", { class: "gear-row" }, [
    el("div", { class: "gear-row-label", text: SLOT_LABEL[slot] }),
    el("div", { class: "gear-row-items" }, items),
  ]);
}

function equipArtifactSection(s, refresh) {
  const equipped = s.player.equippedArtifacts;
  const inactive = s.player.artifacts.filter((id) => !equipped.includes(id));
  const full = equipped.length >= MAX_EQUIPPED_ARTIFACTS;

  const chip = (id, isOn) => {
    const def = artifactDefs[id];
    const node = el(
      "div",
      {
        class: ["relic-chip", `rarity-${def ? def.rarity : "common"}`, isOn ? "equipped" : null, !isOn && full ? "locked" : null],
        onMouseEnter: def ? (e) => showAnchoredTip(e.currentTarget, def.name, def.description) : null,
        onMouseLeave: def ? hideCardTooltips : null,
        onClick: () => {
          if (isOn) unequipArtifact(s, id);
          else equipArtifact(s, id); // no-op when full
          refresh();
        },
      },
      [el("span", { class: "relic-chip-name", text: def ? def.name : id })]
    );
    return node;
  };

  const wrap = el("div", { class: "relic-section" });
  wrap.append(el("h3", { class: "equip-section-title", text: `Artifacts (${equipped.length}/${MAX_EQUIPPED_ARTIFACTS} equipped)` }));
  if (!s.player.artifacts.length) {
    wrap.append(el("p", { class: "muted", text: "No relics found yet." }));
    return wrap;
  }
  wrap.append(el("div", { class: "relic-grid" }, equipped.length ? equipped.map((id) => chip(id, true)) : [el("p", { class: "muted", text: "None equipped." })]));
  if (inactive.length) {
    wrap.append(el("div", { class: "equip-subtle", text: full ? "Owned — not equipped (slots full):" : "Owned — not equipped:" }));
    wrap.append(el("div", { class: "relic-grid" }, inactive.map((id) => chip(id, false))));
  }
  return wrap;
}

function buildEquipmentPanel(s, panel, refresh, close) {
  panel.append(
    el("div", { class: "equip-header" }, [
      el("h2", { class: "equip-title", text: "Equipment" }),
      el("button", { class: "btn", text: "Close", onClick: close }),
    ])
  );
  panel.append(el("div", { class: "gear-rows" }, GEAR_SLOTS.map((slot) => equipGearRow(s, slot, refresh))));
  panel.append(equipArtifactSection(s, refresh));
  panel.append(
    el("div", { class: "equip-footer" }, [
      el("button", { class: ["btn", "btn-primary"], text: "Close", onClick: close }),
    ])
  );
}

// Overlay the current screen with the equipment pop-up (does not change status).
function openEquipmentModal() {
  const app = document.getElementById("app");
  const overlay = el("div", {
    class: "modal-overlay",
    onClick: (e) => { if (e.target === overlay) overlay.remove(); },
  });
  const panel = el("div", { class: ["modal-panel", "equipment-modal"] });
  overlay.append(panel);
  app.append(overlay);

  const close = () => { hideCardTooltips(); overlay.remove(); };
  function refresh() {
    // a clicked chip is replaced in place (no mouseleave fires), so drop any
    // open tooltip before rebuilding
    if (typeof hideCardTooltips === "function") hideCardTooltips();
    panel.innerHTML = "";
    buildEquipmentPanel(state, panel, refresh, close);
  }
  refresh();
}
