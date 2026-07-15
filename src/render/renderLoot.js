// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// Post-combat loot reward screen. Click drops to toggle selection, then take.
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

function toggleLoot(instanceId) {
  const sel = state.lootSelected;
  if (sel.has(instanceId)) sel.delete(instanceId);
  else sel.add(instanceId);
  render();
}

function renderLoot(s) {
  const app = document.getElementById("app");
  const screen = el("div", { class: "loot-screen" });

  screen.append(el("h2", { class: "loot-title", text: "Salvage" }));

  if (s.pendingLootCredits > 0) {
    screen.append(
      el("p", { class: "muted", text: `+${s.pendingLootCredits} credits recovered.` })
    );
  }

  if (s.pendingArtifact) {
    screen.append(
      el("p", { class: "artifact-drop", text: `Artifact acquired: ${s.pendingArtifact.name} — ${s.pendingArtifact.description}` })
    );
  }

  if (s.pendingLoot.length === 0) {
    screen.append(el("p", { class: "muted", text: "No items dropped." }));
  } else {
    const grid = el(
      "div",
      { class: "loot-grid" },
      s.pendingLoot.map((c) =>
        renderCardFace(s, c, {
          showSell: true,
          selected: s.lootSelected.has(c.instanceId),
          onClick: () => toggleLoot(c.instanceId),
        })
      )
    );
    screen.append(grid);
  }

  const buttons = el("div", { class: "loot-buttons" }, [
    el("button", {
      class: ["btn", "btn-primary"],
      text: `Take Selected (${s.lootSelected.size})`,
      onClick: () => {
        takeLoot([...s.lootSelected]);
        leaveLoot();
      },
    }),
    el("button", {
      class: "btn",
      text: "Take All",
      onClick: () => {
        takeLoot(s.pendingLoot.map((c) => c.instanceId));
        leaveLoot();
      },
    }),
    el("button", { class: "btn", text: "Leave All", onClick: () => leaveLoot() }),
    el("button", { class: "btn", text: "View Deck", onClick: openDeckModal }),
    el("button", { class: "btn", text: "Abandon Run", onClick: () => goToStatus(Status.TITLE) }),
  ]);
  screen.append(buttons);

  app.append(screen);
}

registerRenderer(Status.LOOT_REWARD, renderLoot);

// ----- relic tile reward -----------------------------------------------------
// Shown when a map relic tile grants a relic. The relic is already owned by the
// time we get here (grantRandomArtifact ran); this is a confirmation screen.
function renderRelicReward(s) {
  const app = document.getElementById("app");
  const relic = s.pendingArtifact;
  const screen = el("div", { class: "loot-screen relic-reward" });

  screen.append(el("h2", { class: "loot-title", text: "Relic Found" }));
  if (relic) {
    screen.append(el("div", { class: "relic-card" }, [
      el("div", { class: ["relic-name", `rarity-${relic.rarity || "common"}`], text: relic.name }),
      el("p", { class: "relic-desc", text: relic.description }),
    ]));
  } else {
    screen.append(el("p", { class: "muted", text: "Nothing of use remains." }));
  }

  screen.append(el("div", { class: "loot-buttons" }, [
    el("button", { class: ["btn", "btn-primary"], text: "Take Relic", onClick: () => leaveLoot() }),
    el("button", { class: "btn", text: "View Deck", onClick: openDeckModal }),
  ]));

  app.append(screen);
}

registerRenderer(Status.RELIC_REWARD, renderRelicReward);
