// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// Trader, Doctor, Mechanic, Extraction confirm, Run summary, Event screens.
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

function serviceTopBar(s) {
  const p = s.player;
  const stat = (label, value, cls) =>
    el("div", { class: ["stat", cls] }, [
      el("span", { class: "stat-label", text: label }),
      el("span", { class: "stat-value", text: String(value) }),
    ]);
  return el("div", { class: "combat-topbar" }, [
    stat("HP", `${p.hp}/${p.maxHp}`, "stat-hp"),
    stat("Radiation", `${p.radiation}/${RAD_MAX}`, "stat-rad"),
    stat("Credits", p.credits, "stat-credits"),
    stat("Deck", p.deck.length, "stat-deck"),
    el("button", { class: "btn", text: "View Deck", onClick: openDeckModal }),
  ]);
}

// ----- trader ------------------------------------------------------------

function renderTrader(s) {
  const app = document.getElementById("app");
  const t = s.currentTrader;
  const screen = el("div", { class: "service-screen" });

  screen.append(serviceTopBar(s));
  screen.append(el("h2", { class: "service-title", text: "Trader" }));

  // BUY column
  const buyCol = el("div", { class: "service-col" }, [
    el("h3", { text: "For Sale" }),
    el(
      "div",
      { class: "service-cards" },
      t.offers.length
        ? t.offers.map((offer, i) =>
            el("div", { class: "offer" }, [
              renderCardFace(s, offer.card, { showSell: false }),
              el("button", {
                class: ["btn", s.player.credits >= offer.price ? "btn-primary" : null],
                text: `Buy ${offer.price}`,
                onClick: () => tryBuyOffer(i),
              }),
            ])
          )
        : [el("p", { class: "muted", text: "Sold out." })]
    ),
  ]);

  // SELL / REMOVE column (your deck)
  const removeMode = t.removeMode;
  const sellCol = el("div", { class: "service-col" }, [
    el("h3", { text: removeMode ? `Remove a card (${currentRemoveFee()}cr)` : "Your Deck — click to sell" }),
    el(
      "div",
      { class: "service-cards" },
      s.player.deck.map((c) => {
        const sellable = c.canSell !== false && c.sellValue > 0;
        const removable = true; // any card can be paid away — thinning basics is the core move
        const clickable = removeMode ? removable : sellable;
        return renderCardFace(s, c, {
          showSell: !removeMode,
          disabled: !clickable,
          onClick: clickable
            ? removeMode
              ? () => tryRemoveForFee(c.instanceId)
              : () => trySellCard(c.instanceId)
            : null,
        });
      })
    ),
  ]);

  screen.append(el("div", { class: "service-columns" }, [buyCol, sellCol]));

  screen.append(
    el("div", { class: "service-buttons" }, [
      el("button", {
        class: ["btn", removeMode ? "btn-primary" : null],
        text: removeMode ? "Cancel Remove" : `Remove a Card (${currentRemoveFee()})`,
        onClick: toggleTraderRemoveMode,
      }),
      el("button", { class: ["btn", "btn-primary"], text: "Leave", onClick: leaveService }),
    ])
  );

  app.append(screen);
}

// ----- doctor ------------------------------------------------------------

function renderDoctor(s) {
  const app = document.getElementById("app");
  const p = s.player;
  const screen = el("div", { class: "service-screen" });

  screen.append(serviceTopBar(s));
  screen.append(el("h2", { class: "service-title", text: "Doctor" }));

  const option = (label, cost, onClick, enabled) =>
    el("div", { class: "doctor-option" }, [
      el("span", { text: label }),
      el("button", {
        class: ["btn", enabled ? "btn-primary" : null],
        text: `${cost} cr`,
        onClick: enabled ? onClick : null,
      }),
    ]);

  const hurt = p.hp < p.maxHp;
  const irradiated = p.radiation > 0;

  screen.append(
    el("div", { class: "doctor-options" }, [
      option("Heal 15 HP", 5, () => tryDoctorHeal(15, 5), hurt && p.credits >= 5),
      option("Heal to full", 12, () => tryDoctorHeal("full", 12), hurt && p.credits >= 12),
      option("Remove 3 Radiation", 6, () => tryDoctorRad(3, 6), irradiated && p.credits >= 6),
      option("Remove all Radiation", 15, () => tryDoctorRad("all", 15), irradiated && p.credits >= 15),
    ])
  );

  screen.append(
    el("div", { class: "service-buttons" }, [
      el("button", { class: ["btn", "btn-primary"], text: "Leave", onClick: leaveService }),
    ])
  );

  app.append(screen);
}

// ----- mechanic ----------------------------------------------------------

function renderMechanic(s) {
  const app = document.getElementById("app");
  const screen = el("div", { class: "service-screen" });

  screen.append(serviceTopBar(s));
  screen.append(el("h2", { class: "service-title", text: "Mechanic" }));
  screen.append(
    el("p", { class: "muted", text: `Upgrade one card for ${UPGRADE_FEE} credits. Click an eligible card.` })
  );

  const upgradable = s.player.deck.filter(canUpgrade);
  screen.append(
    el(
      "div",
      { class: "service-cards" },
      upgradable.length
        ? upgradable.map((c) =>
            renderCardFace(s, c, {
              disabled: s.player.credits < UPGRADE_FEE,
              onClick: s.player.credits >= UPGRADE_FEE ? () => tryMechanicUpgrade(c.instanceId) : null,
            })
          )
        : [el("p", { class: "muted", text: "No cards left to upgrade." })]
    )
  );

  const junkCount = s.player.deck.filter((c) => c.templateId === "junk").length;
  screen.append(
    el("div", { class: "service-buttons" }, [
      junkCount
        ? el("button", { class: "btn", text: `Remove ${junkCount} Junk (Free)`, onClick: removeAllJunk })
        : null,
      el("button", { class: ["btn", "btn-primary"], text: "Leave", onClick: leaveService }),
    ])
  );

  app.append(screen);
}

// ----- extraction confirm ------------------------------------------------

function renderExtractionConfirm(s) {
  const app = document.getElementById("app");
  const p = s.player;
  const screen = el("div", { class: "placeholder-screen" });

  screen.append(el("h2", { class: "loot-title", text: "Extraction Point" }));
  screen.append(
    el("div", { class: "extract-summary" }, [
      el("p", { text: `Credits: ${p.credits}` }),
      el("p", { text: `Salvage value in pack: ${sellableDeckValue()}` }),
      el("p", { text: `HP ${p.hp}/${p.maxHp} · Radiation ${p.radiation}/${RAD_MAX}` }),
      el("p", { text: `Deck size: ${p.deck.length}` }),
    ])
  );
  screen.append(
    el("div", { class: "service-buttons" }, [
      el("button", { class: ["btn", "btn-primary"], text: "Extract Now", onClick: extractRun }),
      el("button", { class: "btn", text: "Keep Going", onClick: showMap }),
    ])
  );

  app.append(screen);
}

// ----- run summary -------------------------------------------------------

function renderRunSummary(s) {
  const app = document.getElementById("app");
  const r = s.runResult || {};
  const died = r.outcome === "died";
  const screen = el("div", { class: "placeholder-screen" });

  screen.append(
    el("h2", {
      class: died ? "outcome-lose" : "outcome-win",
      text: died ? "Expedition Lost" : "Extraction Successful",
    })
  );

  const rows = died
    ? [
        el("p", { text: r.preserved ? `Preserved: ${r.preserved}` : "Nothing preserved." }),
        el("p", { class: "muted", text: `Total banked across runs: ${s.meta.bankedCredits}` }),
      ]
    : [
        el("p", { text: `Credits banked: ${r.credits ?? 0}` }),
        el("p", { text: `Salvage carried out: ${r.salvageValue ?? 0}` }),
        el("p", { text: `Final deck size: ${r.deckSize ?? 0}` }),
        el("p", { class: "muted", text: `Total banked across runs: ${s.meta.bankedCredits}` }),
      ];
  screen.append(el("div", { class: "extract-summary" }, rows));

  screen.append(
    el("button", { class: ["btn", "btn-primary"], text: "New Expedition", onClick: startNewRun })
  );
  app.append(screen);
}

// ----- event -------------------------------------------------------------

// Run a choice's apply(), capture its result line, advance to the result phase.
function resolveEventChoice(applyFn) {
  const ev = state.currentEvent;
  ev.result = applyFn(state) || "";
  ev.done = true;
  render();
}

// selectCard with count 1 applies on click; count > 1 toggles a selection.
function eventSelectCard(instanceId) {
  const ev = state.currentEvent;
  const def = ev.def;
  const card = state.player.deck.find((c) => c.instanceId === instanceId);
  if (!card) return;
  if ((def.count || 1) === 1) {
    resolveEventChoice(() => def.applyToCards(state, [card]));
    return;
  }
  const i = ev.selected.indexOf(instanceId);
  if (i >= 0) ev.selected.splice(i, 1);
  else if (ev.selected.length < def.count) ev.selected.push(instanceId);
  render();
}

function confirmEventSelection() {
  const ev = state.currentEvent;
  const cards = ev.selected
    .map((id) => state.player.deck.find((c) => c.instanceId === id))
    .filter(Boolean);
  if (!cards.length) return;
  resolveEventChoice(() => ev.def.applyToCards(state, cards));
}

function finishEvent() {
  if (state.currentTile) {
    state.currentTile.resolved = true;
    state.currentTile = null;
  }
  state.currentEvent = null;
  showMap();
}

function renderEventChoices(s, ev, screen) {
  const choices = ev.def.choices(s, ev);
  screen.append(
    el(
      "div",
      { class: "event-choices" },
      choices.map((ch) =>
        el("button", {
          class: ["btn", "btn-primary", "event-choice"],
          onClick: () => resolveEventChoice(ch.apply),
        }, [
          el("span", { class: "event-choice-label", text: ch.label }),
          ch.desc ? el("span", { class: "event-choice-desc", text: ch.desc }) : null,
        ])
      )
    )
  );
}

function renderEventSelect(s, ev, screen) {
  const def = ev.def;
  const eligible = s.player.deck.filter(def.filter);
  if (!eligible.length) {
    screen.append(el("p", { class: "muted", text: "No eligible cards." }));
    screen.append(el("button", { class: ["btn", "btn-primary"], text: "Continue", onClick: finishEvent }));
    return;
  }
  const multi = (def.count || 1) > 1;
  screen.append(
    el("div", { class: "loot-grid" }, eligible.map((c) =>
      renderCardFace(s, c, {
        showSell: def.verb === "Sell",
        selected: ev.selected.includes(c.instanceId),
        onClick: () => eventSelectCard(c.instanceId),
      })
    ))
  );
  if (multi) {
    screen.append(el("div", { class: "service-buttons" }, [
      el("button", {
        class: ["btn", ev.selected.length ? "btn-primary" : null],
        text: `${def.verb} Selected (${ev.selected.length}/${def.count})`,
        onClick: ev.selected.length ? confirmEventSelection : null,
      }),
    ]));
  }
}

function renderEvent(s) {
  const app = document.getElementById("app");
  const ev = s.currentEvent;
  const screen = el("div", { class: "event-screen" });
  if (!ev) { app.append(screen); return; }

  screen.append(el("h2", { class: "loot-title", text: ev.def.name }));
  screen.append(el("p", { class: ["event-rarity", `rarity-${ev.def.rarity}`], text: ev.def.rarity }));
  screen.append(el("p", { class: "event-text", text: ev.def.text }));

  if (ev.done) {
    if (ev.result) screen.append(el("p", { class: "event-result", text: ev.result }));
    screen.append(el("button", { class: ["btn", "btn-primary"], text: "Continue", onClick: finishEvent }));
  } else if (ev.def.kind === "choice") {
    renderEventChoices(s, ev, screen);
  } else if (ev.def.kind === "selectCard") {
    renderEventSelect(s, ev, screen);
  }

  app.append(screen);
}

registerRenderer(Status.TRADER, renderTrader);
registerRenderer(Status.DOCTOR, renderDoctor);
registerRenderer(Status.MECHANIC, renderMechanic);
registerRenderer(Status.EXTRACTION_CONFIRM, renderExtractionConfirm);
registerRenderer(Status.RUN_SUMMARY, renderRunSummary);
registerRenderer(Status.EVENT, renderEvent);
