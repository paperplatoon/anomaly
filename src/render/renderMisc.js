// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// Title, Loadout, Victory, Death screens.
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

function renderTitle(s) {
  const app = document.getElementById("app");
  const banked = s.meta && s.meta.bankedCredits ? s.meta.bankedCredits : 0;
  app.append(
    el("div", { class: "title-screen" }, [
      el("h1", { class: "title-logo", text: "PROJECT ZONE" }),
      el("p", {
        class: "title-tagline",
        text: "Your backpack is your deck. Scavenge, survive, decide when to leave.",
      }),
      el("button", {
        class: ["btn", "btn-primary"],
        text: "Start Expedition",
        onClick: startNewRun,
      }),
      banked ? el("p", { class: "title-version", text: `Credits banked across runs: ${banked}` }) : null,
      el("div", { class: "title-dev-row" }, [
        el("button", {
          class: "btn",
          text: "Card Gallery (Dev)",
          onClick: () => goToStatus(Status.CARD_GALLERY),
        }),
        el("button", {
          class: "btn",
          text: "Bestiary (Dev)",
          onClick: () => goToStatus(Status.ENEMY_GALLERY),
        }),
        el("button", {
          class: "btn",
          text: "Event List (Dev)",
          onClick: () => goToStatus(Status.EVENT_GALLERY),
        }),
      ]),
      el("p", { class: "title-version", text: "MVP v0.1" }),
    ])
  );
}

// ----- loadout: choose a carried-over item (§5.1) ------------------------

function renderLoadout(s) {
  const app = document.getElementById("app");
  const items = s.meta.preservedItems || [];
  const screen = el("div", { class: "loot-screen" }, [
    el("h2", { class: "loot-title", text: "Loadout" }),
    el("p", { class: "muted", text: "Choose one preserved item to carry into this expedition." }),
  ]);

  const grid = el(
    "div",
    { class: "loot-grid" },
    items.map((item, i) => {
      const preview = makeCard(item.templateId);
      if (item.upgraded) upgradeCard(preview);
      return renderCardFace(s, preview, {
        showSell: true,
        onClick: () => chooseLoadout(i),
      });
    })
  );
  screen.append(grid);
  screen.append(
    el("div", { class: "loot-buttons" }, [
      el("button", { class: ["btn", "btn-primary"], text: "Take None", onClick: () => chooseLoadout(-1) }),
    ])
  );
  app.append(screen);
}

// ----- victory (boss) ----------------------------------------------------

function renderVictory(s) {
  const app = document.getElementById("app");
  const r = s.runResult || {};
  app.append(
    el("div", { class: "placeholder-screen" }, [
      el("h2", { class: "outcome-win", text: "The Core Thing Falls" }),
      el("p", { class: "muted", text: "You beat the Final Laboratory. The run ends in victory." }),
      el("div", { class: "extract-summary" }, [
        el("p", { text: `Credits banked: ${r.credits ?? s.player.credits}` }),
        el("p", { text: `Final deck size: ${r.deckSize ?? s.player.deck.length}` }),
        r.artifact ? el("p", { class: "artifact-drop", text: `Artifact recovered: ${r.artifact}` }) : null,
        el("p", { class: "muted", text: `Total banked across runs: ${s.meta.bankedCredits}` }),
      ]),
      el("button", { class: ["btn", "btn-primary"], text: "New Expedition", onClick: startNewRun }),
    ])
  );
}

// ----- death: preserve one item (§6.3) -----------------------------------

function renderDeath(s) {
  const app = document.getElementById("app");
  const keepable = s.player.deck.filter((c) => c.rarity !== "starter");

  const screen = el("div", { class: "loot-screen" }, [
    el("h2", { class: "outcome-lose", text: "You Died" }),
    el("p", {
      class: "muted",
      text: keepable.length
        ? "The Zone keeps your pack — but you can preserve one item for a future run."
        : "The Zone keeps your pack. You carried nothing worth preserving.",
    }),
  ]);

  if (keepable.length) {
    screen.append(
      el(
        "div",
        { class: "loot-grid" },
        keepable.map((c) =>
          renderCardFace(s, c, { showSell: true, onClick: () => preserveItem(c.instanceId) })
        )
      )
    );
  }

  screen.append(
    el("div", { class: "loot-buttons" }, [
      el("button", {
        class: ["btn", "btn-primary"],
        text: "Preserve Nothing",
        onClick: () => {
          s.runResult = { outcome: "died", preserved: null };
          goToStatus(Status.RUN_SUMMARY);
        },
      }),
    ])
  );

  app.append(screen);
}

registerRenderer(Status.TITLE, renderTitle);
registerRenderer(Status.LOADOUT, renderLoadout);
registerRenderer(Status.VICTORY, renderVictory);
registerRenderer(Status.DEATH, renderDeath);
