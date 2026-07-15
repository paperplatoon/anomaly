// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// Post-combat REWARDS screen. Lists up to three rewards ("Pick a reward" /
// "Random reward" / "Salvage found"); clicking one opens its decision panel:
//   pick    — 3 cards, click one to add it to the deck, or Skip (+1 credit)
//   random  — 1 random card, Take or Skip (no credit)
//   salvage — 1 Valuable Salvage, Take or Skip (no credit)
// Continue leaves any unclaimed rewards behind. (Also hosts the relic screen.)
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const REWARD_ICON = { pick: "🎁", random: "❓", salvage: "◆" };

function rewardTileStatus(r) {
  if (!r.done) return null;
  return r.taken ? `Took ${r.taken.name}` : "Skipped";
}

// One clickable reward row on the rewards list.
function renderRewardTile(s, r, index) {
  return el(
    "div",
    {
      class: ["reward-tile", r.done ? "reward-done" : null],
      onClick: r.done ? null : () => openReward(index),
    },
    [
      el("span", { class: "reward-icon", text: REWARD_ICON[r.kind] || "🎁" }),
      el("span", { class: "reward-label", text: r.label }),
      r.done
        ? el("span", { class: "reward-status", text: rewardTileStatus(r) })
        : el("span", { class: "reward-hint", text: "Click to open" }),
    ]
  );
}

// Decision panel for the currently-open reward.
function renderRewardDecision(s, r) {
  const panel = el("div", { class: "reward-decision" });
  const heading = {
    pick: "Choose a card to add to your pack",
    random: "You found something. Take it?",
    salvage: "Valuable salvage! Take it?",
  }[r.kind] || r.label;

  panel.append(el("h3", { class: "reward-decision-title", text: heading }));
  panel.append(
    el(
      "div",
      { class: "loot-grid" },
      r.cards.map((c) =>
        renderCardFace(s, c, {
          showSell: r.kind === "salvage",
          onClick: (e) => {
            // golden burst + card flies into the pack, then the state change
            if (typeof spawnRewardPickFx === "function") spawnRewardPickFx(e.currentTarget);
            chooseRewardCard(c.instanceId);
          },
        })
      )
    )
  );
  panel.append(
    el("div", { class: "loot-buttons" }, [
      el("button", {
        class: ["btn", "btn-primary"],
        text: r.kind === "pick" ? "Skip (+1 credit)" : "Skip",
        onClick: skipReward,
      }),
      el("button", { class: "btn", text: "Back", onClick: closeReward }),
    ])
  );
  return panel;
}

function renderLoot(s) {
  const app = document.getElementById("app");
  const screen = el("div", { class: "loot-screen" });

  screen.append(el("h2", { class: "loot-title", text: "Rewards" }));

  if (s.pendingRewardCredits > 0) {
    screen.append(el("p", { class: "muted", text: `+${s.pendingRewardCredits} credits recovered.` }));
  }
  if (s.pendingArtifact) {
    screen.append(
      el("p", { class: "artifact-drop", text: `Relic acquired: ${s.pendingArtifact.name} — ${s.pendingArtifact.description}` })
    );
  }

  const active = s.activeRewardIndex != null ? s.pendingRewards[s.activeRewardIndex] : null;

  if (active && !active.done) {
    screen.append(renderRewardDecision(s, active));
  } else {
    if (!s.pendingRewards.length) {
      screen.append(el("p", { class: "muted", text: "Nothing salvageable here." }));
    } else {
      screen.append(
        el("div", { class: "reward-list" }, s.pendingRewards.map((r, i) => renderRewardTile(s, r, i)))
      );
    }
    screen.append(
      el("div", { class: "loot-buttons" }, [
        el("button", { class: ["btn", "btn-primary"], text: "Continue", onClick: () => leaveLoot() }),
        el("button", { class: "btn", text: "View Deck", onClick: openDeckModal }),
        el("button", { class: "btn", text: "Abandon Run", onClick: () => goToStatus(Status.TITLE) }),
      ])
    );
  }

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
