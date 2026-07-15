// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// Map events. Each event is one of three kinds, all driven by the renderer:
//   - "auto"       : applies on arrival, shows a result line + Continue.
//   - "choice"     : pick one of several options (choices(s, ev)).
//   - "selectCard" : pick card(s) from the deck (filter/count), then applyToCards.
// Optional onOpen(s, ev) stashes generated data (e.g. rolled equipment) on the
// live currentEvent so choices/labels are stable across re-renders.
//
// Rarity controls how often an event appears: common > uncommon > rare via
// EVENT_RARITY_WEIGHT. Add an event by dropping a def in eventDefs.
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

// helpers shared by events -----------------------------------------------------

function eventRemoveFromDeck(s, card) {
  const i = s.player.deck.findIndex((c) => c.instanceId === card.instanceId);
  if (i >= 0) s.player.deck.splice(i, 1);
}

function randomRareCardId() {
  const ids = Object.keys(cardTemplates).filter((id) => cardTemplates[id].rarity === "rare");
  return ids.length ? ids[randInt(0, ids.length - 1)] : null;
}

function equipMessage(res) {
  if (!res || !res.item) return "";
  return res.equipped ? `Equipped ${res.item.name}.` : `Stowed ${res.item.name} in your stash.`;
}

// events -----------------------------------------------------------------------

const eventDefs = [
  // ===================== COMMON =====================
  {
    id: "fieldTuning", name: "Field Tuning", rarity: "common",
    kind: "choice",
    text: "A tinker offers to tune your gear. Choose one.",
    choices: () => [
      { label: "+1 Shoot", desc: "Permanently boost gun damage.", apply: (s) => { s.player.shootBonus += 1; return "Gun damage permanently +1."; } },
      { label: "+1 Block", desc: "Permanently boost shield block.", apply: (s) => { s.player.blockBonus += 1; return "Shield block permanently +1."; } },
      { label: "+5 Knife", desc: "Permanently boost knife damage.", apply: (s) => { s.player.knifeBonus += 5; return "Knife damage permanently +5."; } },
    ],
  },
  {
    id: "armory", name: "Old Armory", rarity: "common",
    kind: "auto",
    text: "You strip a wrecked armory for parts and refit your basics.",
    apply: (s) => {
      s.player.deck.forEach((c) => {
        if (c.templateId === "basicShield") c.block += 2;
        if (c.templateId === "shoot") c.damage += 4;
      });
      return "Basic Shields gain +2 Block. Basic Shoots gain +4 damage.";
    },
  },
  {
    id: "wanderingTinker", name: "Wandering Tinker", rarity: "common",
    kind: "selectCard",
    text: "A tinker will strip one card from your pack, free of charge.",
    filter: () => true, count: 1, verb: "Remove",
    applyToCards: (s, cards) => { eventRemoveFromDeck(s, cards[0]); return `Removed ${cards[0].name}.`; },
  },
  {
    id: "reinforcedPlating", name: "Reinforced Plating", rarity: "common",
    kind: "selectCard",
    text: "Choose a Shield card. Its Block is doubled.",
    filter: (c) => c.tags && c.tags.includes("shield"), count: 1, verb: "Reinforce",
    applyToCards: (s, cards) => { cards[0].block *= 2; return `${cards[0].name} now blocks ${cards[0].block}.`; },
  },
  {
    id: "armorPiercing", name: "Armor-Piercing Rounds", rarity: "common",
    kind: "selectCard",
    text: "Choose a gun card. It deals +6 damage.",
    filter: (c) => c.tags && c.tags.includes("shoot"), count: 1, verb: "Upgrade",
    applyToCards: (s, cards) => { cards[0].damage += 6; return `${cards[0].name} now deals ${cards[0].damage}.`; },
  },
  {
    id: "whetstone", name: "Whetstone", rarity: "common",
    kind: "selectCard",
    text: "Choose a Knife card. Its damage is doubled.",
    filter: (c) => c.tags && c.tags.includes("knife"), count: 1, verb: "Sharpen",
    applyToCards: (s, cards) => { cards[0].damage *= 2; return `${cards[0].name} now deals ${cards[0].damage}.`; },
  },
  {
    id: "rovingCollector", name: "Roving Collector", rarity: "common",
    kind: "selectCard",
    text: "A collector pays double for salvage. Choose up to 2 cards to sell.",
    filter: (c) => c.canSell !== false && c.sellValue > 0, count: 2, verb: "Sell",
    applyToCards: (s, cards) => {
      let gained = 0;
      cards.forEach((c) => { gained += c.sellValue * 2; eventRemoveFromDeck(s, c); });
      s.player.credits += gained;
      return `Sold ${cards.length} card(s) for ${gained} credits.`;
    },
  },

  // ===================== UNCOMMON =====================
  {
    id: "fieldHospital", name: "Field Hospital", rarity: "uncommon",
    kind: "choice",
    text: "A field medic can spare you one treatment.",
    choices: () => [
      { label: "+10 Max HP", desc: "Raise your maximum HP by 10.", apply: (s) => { s.player.maxHp += 10; s.player.hp += 10; return "Max HP increased by 10."; } },
      { label: "Cleanse Radiation", desc: "Remove all Radiation.", apply: (s) => { const r = s.player.radiation; s.player.radiation = 0; return `Cleansed ${r} Radiation.`; } },
      { label: "Heal 25 HP", desc: "Restore 25 HP.", apply: (s) => { const b = s.player.hp; s.player.hp = Math.min(s.player.maxHp, s.player.hp + 25); return `Healed ${s.player.hp - b} HP.`; } },
    ],
  },
  {
    id: "combatStims", name: "Combat Stims", rarity: "uncommon",
    kind: "auto",
    text: "You lace your basic gear with stimulants.",
    apply: (s) => {
      s.player.deck.forEach((c) => {
        if (c.templateId === "basicShield") c.healOnPlay += 1;
        if (c.templateId === "shoot") c.healOnPlay += 2;
      });
      return "Basic Shields heal 1 and basic Shoots heal 2 when played.";
    },
  },
  {
    id: "weaponsCache", name: "Weapons Cache", rarity: "uncommon",
    kind: "choice",
    text: "A buried cache holds two pieces of gear. Take one.",
    onOpen: (s, ev) => {
      ev.gun = randomEquipment({ slot: "weapon" });
      ev.shield = randomEquipment({ slot: "armor" });
    },
    choices: (s, ev) => [
      { label: `${ev.gun.name} (+${ev.gun.amount} Shoot)`, desc: `${ev.gun.rarity} gun`, apply: (s2) => equipMessage(acquireEquipment(s2, ev.gun)) },
      { label: `${ev.shield.name} (+${ev.shield.amount} Block)`, desc: `${ev.shield.rarity} armor`, apply: (s2) => equipMessage(acquireEquipment(s2, ev.shield)) },
    ],
  },

  // ===================== RARE =====================
  {
    id: "blackMarket", name: "Black Market", rarity: "rare",
    kind: "choice",
    text: "A masked dealer makes you an offer.",
    choices: () => [
      {
        label: "Relic (−10 Max HP)", desc: "Gain a random relic, but lose 10 Max HP.",
        apply: (s) => {
          const d = typeof grantRandomArtifact === "function" ? grantRandomArtifact(s) : null;
          s.player.maxHp = Math.max(1, s.player.maxHp - 10);
          s.player.hp = Math.min(s.player.hp, s.player.maxHp);
          return d ? `Gained relic: ${d.name}. Max HP −10.` : "No relics left to offer. Max HP −10.";
        },
      },
      {
        label: "Random Rare Card", desc: "Add a random rare card to your deck.",
        apply: (s) => {
          const id = randomRareCardId();
          if (!id) return "No rare cards available.";
          s.player.deck.push(makeCard(id));
          return `Added ${cardTemplates[id].name} to your deck.`;
        },
      },
    ],
  },
  {
    id: "hiddenArsenal", name: "Hidden Arsenal", rarity: "rare",
    kind: "choice",
    text: "Beneath a collapsed bunker, two prizes remain.",
    choices: () => [
      {
        label: "Random Relic", desc: "Gain a random relic.",
        apply: (s) => { const d = typeof grantRandomArtifact === "function" ? grantRandomArtifact(s) : null; return d ? `Gained relic: ${d.name}.` : "No relics left to offer."; },
      },
      {
        label: "Random Rare Gun", desc: "Gain a random rare gun.",
        apply: (s) => { const g = randomEquipment({ slot: "weapon", rarity: "rare" }); return g ? equipMessage(acquireEquipment(s, g)) : "No rare guns available."; },
      },
    ],
  },
];

// selection ---------------------------------------------------------------------

const EVENT_RARITY_WEIGHT = { common: 3, uncommon: 2, rare: 1 };

function pickWeightedEvent() {
  const bag = [];
  eventDefs.forEach((e) => {
    const w = EVENT_RARITY_WEIGHT[e.rarity] || 1;
    for (let i = 0; i < w; i++) bag.push(e);
  });
  return bag[randInt(0, bag.length - 1)];
}
