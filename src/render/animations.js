// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// Combat animation layer. Effects spawn in a body-level overlay (#anim-layer)
// so full re-renders can't wipe them. During an animation sequence the combat
// screen is NOT re-rendered; instead these helpers update HP bars / numbers
// surgically (bars CSS-transition their width), and one render() reconciles at
// rest. Primitives push semantic events onto animationQueue; the player-card
// path drains and plays them, the enemy path drives visuals directly.
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

let animationQueue = [];

function queueAnim(evt) {
  if (state.status !== Status.COMBAT) return;
  animationQueue.push(evt);
}
function clearAnims() {
  animationQueue = [];
}
function drainAnimQueue() {
  const q = animationQueue;
  animationQueue = [];
  return q;
}

// ----- element getters -----------------------------------------------------

function enemyEl(iid) {
  if (typeof document === "undefined" || !document.querySelector) return null;
  return document.querySelector(`[data-iid="${iid}"]`);
}
function playerAvatarEl() {
  return document.getElementById("player-avatar");
}
function playerAnchor() {
  return playerAvatarEl();
}
function energyAnchor() {
  return document.getElementById("energy-orb");
}
function enemyRowFallback() {
  return document.getElementById("enemy-side");
}

// ----- overlay plumbing ----------------------------------------------------

function ensureAnimLayer() {
  let layer = document.getElementById("anim-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "anim-layer";
    document.body.appendChild(layer);
  }
  return layer;
}
function centerOf(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
function spawnAt(anchor, className, lifeMs) {
  if (!anchor) return null;
  const layer = ensureAnimLayer();
  const { x, y } = centerOf(anchor);
  const node = document.createElement("div");
  node.className = className;
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  layer.appendChild(node);
  setTimeout(() => node.remove(), lifeMs);
  return node;
}
function floatText(anchor, text, cls) {
  if (!anchor) return;
  const node = spawnAt(anchor, `float-text ${cls}`, 950);
  if (!node) return;
  node.textContent = text;
  node.style.left = `${parseFloat(node.style.left) + (Math.random() - 0.5) * 40}px`;
}
function flashEl(el, cls, ms = 240) {
  if (!el) return;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}
function screenShake() {
  const app = document.getElementById("app");
  if (!app) return;
  app.classList.remove("shake");
  void app.offsetWidth;
  app.classList.add("shake");
  setTimeout(() => app.classList.remove("shake"), 320);
}

// ----- surgical bar / stat setters (used mid-sequence, no re-render) --------

function setEnemyBar(iid, hp, maxHp) {
  const el = enemyEl(iid);
  if (!el) return;
  const fill = el.querySelector(".hp-bar-fill");
  const txt = el.querySelector(".hp-bar-text");
  if (fill) fill.style.width = `${Math.max(0, (hp / maxHp) * 100)}%`;
  if (txt) txt.textContent = `${Math.max(0, hp)}/${maxHp}`;
}
function setEnemyBlock(iid, n) {
  const el = enemyEl(iid);
  if (!el) return;
  const badge = el.querySelector(".block-badge");
  if (badge) {
    badge.textContent = n > 0 ? `\u{1F6E1} ${n}` : "";
    badge.style.display = n > 0 ? "flex" : "none";
  }
}
function setPlayerBars() {
  const p = state.player;
  const hp = document.getElementById("player-hp");
  if (hp) {
    const f = hp.querySelector(".hp-bar-fill");
    const t = hp.querySelector(".hp-bar-text");
    if (f) f.style.width = `${Math.max(0, (p.hp / p.maxHp) * 100)}%`;
    if (t) t.textContent = `${Math.max(0, p.hp)}/${p.maxHp}`;
  }
  const rad = document.getElementById("player-rad");
  if (rad) {
    const f = rad.querySelector(".rad-bar-fill");
    const t = rad.querySelector(".rad-bar-text");
    if (f) f.style.width = `${Math.min(1, p.radiation / RAD_MAX) * 100}%`;
    if (t) t.textContent = `☢ ${p.radiation}/${RAD_MAX}`;
    rad.classList.toggle("rad-warning", p.radiation >= 15);
  }
  const blk = document.getElementById("player-block");
  if (blk) {
    blk.textContent = p.block > 0 ? `\u{1F6E1} ${p.block}` : "";
    blk.style.display = p.block > 0 ? "flex" : "none";
  }
  const orb = document.getElementById("energy-orb");
  if (orb) {
    const v = orb.querySelector(".energy-value");
    if (v) v.textContent = p.energy;
  }
  syncShieldBubble(p.block);
}

// ----- shield bubble ---------------------------------------------------------
// The blue gridline sphere around the player. It is STATE-KEYED: it exists iff
// block > 0. renderPlayerSide creates it at rest; this keeps it in sync during
// animation sequences (created / pulsed on gains, removed at zero) — so it can
// never leak or go stale no matter where block changes.
function syncShieldBubble(block) {
  const avatar = playerAvatarEl();
  if (!avatar || !avatar.querySelector) return;
  let bub = avatar.querySelector(".shield-bubble");
  if (block > 0) {
    const prev = bub ? Number(bub.getAttribute("data-block") || 0) : 0;
    if (!bub) {
      bub = document.createElement("div");
      bub.className = "shield-bubble";
      avatar.appendChild(bub);
    }
    bub.setAttribute("data-block", String(block));
    if (block > prev) {
      // re-trigger the "grows stronger" pulse
      bub.classList.remove("pulse");
      void bub.offsetWidth;
      bub.classList.add("pulse");
    }
  } else if (bub) {
    bub.classList.add("shield-pop");
    setTimeout(() => bub.remove(), 240);
  }
}

// ----- enemy buff glow -------------------------------------------------------
// Golden aura flash on the avatar whenever an enemy gets stronger.
function enemyBuffGlow(rootEl) {
  if (!rootEl || !rootEl.querySelector) return;
  const avatar = rootEl.querySelector(".enemy-avatar") || rootEl;
  flashEl(avatar, "buff-glow", 900);
}

// ----- draw / discard flights ------------------------------------------------
// Simple card-back rectangles fly pile->hand (draw) or hand->pile (discard).
// The REAL cards never move — they appear/vanish via the normal render; these
// ghosts just communicate where cards came from / went. Anchors are the live
// pile stacks, so this works wherever the layout puts them.
function pileAnchor(kind) {
  if (typeof document === "undefined" || !document.querySelector) return null;
  return document.querySelector(`.card-pile.pile-${kind} .pile-stack`);
}

function flyCardGhost(from, to, delay = 0) {
  const layer = ensureAnimLayer();
  setTimeout(() => {
    const node = document.createElement("div");
    node.className = "fly-card";
    node.style.left = `${from.x - 23}px`;
    node.style.top = `${from.y - 32}px`;
    layer.appendChild(node);
    const go = () => {
      node.style.transform =
        `translate(${to.x - from.x}px, ${to.y - from.y}px) rotate(${(Math.random() - 0.5) * 26}deg) scale(0.55)`;
      node.style.opacity = "0.15";
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => requestAnimationFrame(go));
    else setTimeout(go, 16);
    setTimeout(() => node.remove(), 560);
  }, delay);
}

// N ghosts from the draw pile fanning into the hand area.
function animateDrawFly(count) {
  const from = pileAnchor("draw");
  const hand = document.querySelector(".handbar .hand");
  if (!from || !hand || count <= 0) return;
  const a = centerOf(from);
  const h = centerOf(hand);
  for (let i = 0; i < count; i++) {
    flyCardGhost(a, { x: h.x + (i - (count - 1) / 2) * 36, y: h.y }, i * 70);
  }
}

// Snapshot the hand's card positions BEFORE they're discarded/re-rendered.
function captureHandRects() {
  if (typeof document === "undefined" || !document.querySelectorAll) return null;
  return Array.from(document.querySelectorAll(".hand [data-cid]")).map((n) => {
    const r = n.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
}

// Ghosts from each captured hand position into the discard pile.
function animateDiscardFly(points) {
  const to = pileAnchor("discard");
  if (!to || !points || !points.length) return;
  const b = centerOf(to);
  points.forEach((p, i) => flyCardGhost(p, b, i * 60));
}

// ----- attack fx -----------------------------------------------------------

function currentFx(s, card) {
  const c = card || (s.currentCombat && s.currentCombat.fxCard);
  if (!c || !c.tags) return null;
  if (c.tags.includes("explosive")) return "explosive";
  if (c.tags.includes("aoe")) return "aoe";
  if (c.tags.includes("gun") || c.tags.includes("shoot")) return "gun";
  if (c.tags.includes("knife") || c.tags.includes("melee")) return "melee";
  return null;
}

function spawnTracer(toEl, heavy = false) {
  const fromEl = playerAvatarEl();
  if (!fromEl || !toEl) return;
  const layer = ensureAnimLayer();
  const a = centerOf(fromEl);
  const b = centerOf(toEl);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  const beam = document.createElement("div");
  beam.className = heavy ? "tracer tracer-heavy" : "tracer";
  beam.style.left = `${a.x}px`;
  beam.style.top = `${a.y}px`;
  beam.style.width = `${len}px`;
  beam.style.transform = `rotate(${ang}deg)`;
  beam.appendChild(Object.assign(document.createElement("div"), { className: "tracer-line" }));
  layer.appendChild(beam);
  setTimeout(() => beam.remove(), 300);
  spawnAt(fromEl, "muzzle-flash", 200);
  if (heavy) setTimeout(() => spawnAt(fromEl, "muzzle-flash", 200), 70);
}
function spawnAttackFx(targetEl, fx, amount = 0) {
  switch (fx) {
    case "gun": spawnTracer(targetEl, amount >= 15); break;
    case "aoe": spawnAt(targetEl, "slash-v", 320); break;
    case "explosive": spawnAt(targetEl, "slash-v", 320); spawnAt(targetEl, "burst-ring", 420); break;
    case "melee": spawnKnifeSlash(targetEl); break;
    default: break;
  }
}
function spawnImpactSparks(anchor, count = 6) {
  if (!anchor) return;
  for (let i = 0; i < count; i++) {
    const spark = spawnAt(anchor, "impact-spark", 400);
    if (!spark) continue;
    const ang = Math.random() * Math.PI * 2;
    const dist = 26 + Math.random() * 26;
    spark.style.setProperty("--dx", `${Math.cos(ang) * dist}px`);
    spark.style.setProperty("--dy", `${Math.sin(ang) * dist}px`);
  }
}
function spawnShield(text, hit = false) {
  const node = spawnAt(playerAvatarEl(), hit ? "shield-form shield-hit" : "shield-form", 760);
  if (node) node.textContent = text;
}
function spawnHealParticles(count = 3) {
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const p = spawnAt(playerAvatarEl(), "heal-particle", 750);
      if (p) {
        p.textContent = "+";
        p.style.left = `${parseFloat(p.style.left) + (Math.random() - 0.5) * 44}px`;
      }
    }, i * 100);
  }
}
function impactFrame() {
  const layer = ensureAnimLayer();
  const node = document.createElement("div");
  node.className = "impact-frame";
  layer.appendChild(node);
  setTimeout(() => node.remove(), 120);
}
function spawnBuffFx() {
  spawnAt(playerAvatarEl(), "buff-ring", 520);
  flashEl(playerAvatarEl(), "powered", 520);
}

// Radiation hits the player: expanding hazard ring + a big ☢ that flares up,
// plus the green tint flash. Used by both the card path and enemy moves.
function spawnRadPulse(anchor = playerAvatarEl()) {
  spawnAt(anchor, "rad-pulse", 700);
  const glyph = spawnAt(anchor, "rad-glyph", 700);
  if (glyph) glyph.textContent = "☢";
  flashEl(anchor, "irradiated", 500);
}

// Auto-Block: a blue gridline diamond pulses out of the player (same visual
// language as the shield bubble). Fired when Auto-Block is gained AND when it
// triggers at end of turn.
function spawnAutoBlockFx() {
  spawnAt(playerAvatarEl(), "autoblock-pulse", 700);
}

// Knife slash: a bright arcing swipe + gleam streak across the target —
// visually distinct from the gun tracer.
function spawnKnifeSlash(targetEl) {
  const node = spawnAt(targetEl, "knife-slash", 460);
  if (node) spawnImpactSparks(targetEl, 4);
}

// Golden burst: ring + star sparks. Fired when the player claims a reward card.
function spawnGoldBurst(anchor) {
  if (!anchor) return;
  spawnAt(anchor, "gold-burst", 650);
  for (let i = 0; i < 7; i++) {
    const spark = spawnAt(anchor, "gold-spark", 620);
    if (!spark) continue;
    const ang = Math.random() * Math.PI * 2;
    const dist = 34 + Math.random() * 40;
    spark.style.setProperty("--dx", `${Math.cos(ang) * dist}px`);
    spark.style.setProperty("--dy", `${Math.sin(ang) * dist}px`);
  }
}

// Reward-pick flourish: golden burst on the chosen card, then a card ghost
// flies down into the player's pack. Call BEFORE the state change re-renders.
function spawnRewardPickFx(cardEl) {
  if (!cardEl || typeof cardEl.getBoundingClientRect !== "function") return;
  spawnGoldBurst(cardEl);
  const from = centerOf(cardEl);
  const to = { x: window.innerWidth / 2, y: window.innerHeight + 60 }; // into the pack
  flyCardGhost(from, to, 120);
}

// Played card zips from its hand position into the discard pile, so the
// destination is unmistakable. (Skipped for single-use/recharging cards.)
function flyPlayedCardToDiscard(cid) {
  if (typeof document === "undefined" || !document.querySelector) return;
  const el = document.querySelector(`[data-cid="${cid}"]`);
  const to = pileAnchor("discard");
  if (!el || !to) return;
  flyCardGhost(centerOf(el), centerOf(to), 140);
}

// ----- ghosts / death / banner --------------------------------------------

function ghostFrom(el, cls, lifeMs) {
  if (!el) return;
  const layer = ensureAnimLayer();
  const r = el.getBoundingClientRect();
  const g = el.cloneNode(true);
  g.classList.add(cls);
  g.style.position = "fixed";
  g.style.left = `${r.left}px`;
  g.style.top = `${r.top}px`;
  g.style.width = `${r.width}px`;
  g.style.height = `${r.height}px`;
  g.style.margin = "0";
  layer.appendChild(g);
  setTimeout(() => g.remove(), lifeMs);
}
function spawnCardGhostById(cid) {
  if (typeof document === "undefined" || !document.querySelector) return;
  ghostFrom(document.querySelector(`[data-cid="${cid}"]`), "card-ghost", 500);
}
function removeHandCardEl(cid) {
  if (typeof document === "undefined" || !document.querySelector) return;
  const el = document.querySelector(`[data-cid="${cid}"]`);
  if (el) el.remove();
}
function showEnemyStunned(enemy) {
  floatText(enemyEl(enemy.instanceId), "STUNNED", "block");
}
function spawnBanner(text) {
  const layer = ensureAnimLayer();
  const node = document.createElement("div");
  node.className = "turn-banner";
  node.textContent = text;
  layer.appendChild(node);
  setTimeout(() => node.remove(), 850);
}

// ----- enemy motion (windup / lunge / settle / flex) -----------------------

async function enemyWindup(el) {
  if (el) el.classList.add("windup");
  await pause(240);
}
async function enemyLunge(el) {
  if (el) { el.classList.remove("windup"); el.classList.add("lunge-in"); }
  await pause(190);
}
async function enemySettle(el) {
  if (el) el.classList.remove("lunge-in");
  await pause(220);
}
async function enemyFlex(el) {
  if (el) el.classList.add("flex");
  await pause(220);
  if (el) el.classList.remove("flex");
}

// ----- player-card event playback (sequential) -----------------------------

async function animateEnemyHit(evt) {
  const el = enemyEl(evt.iid);
  spawnAttackFx(el, evt.fx, evt.amount);
  await pause(190); // projectile travel / anticipation
  if (el) el.classList.add("hit-shake");
  setEnemyBar(evt.iid, evt.hpAfter, evt.maxHp);
  if (evt.blockAfter !== undefined) setEnemyBlock(evt.iid, evt.blockAfter);
  if (evt.amount > 0) {
    floatText(el, `-${evt.amount}`, evt.amount >= 20 ? "dmg big" : "dmg");
    spawnImpactSparks(el, evt.amount >= 20 ? 9 : 6);
    if (evt.amount >= 30) impactFrame();
  } else {
    floatText(el, "Blocked", "block");
  }
  await pause(300);
  if (el) el.classList.remove("hit-shake");
  if (evt.hpAfter <= 0 && el) {
    // death: white flash, burst ring, spark shower, then collapse + dissolve
    el.classList.add("enemy-death");
    const avatar = el.querySelector ? el.querySelector(".enemy-avatar") || el : el;
    spawnAt(avatar, "death-burst", 750);
    spawnImpactSparks(avatar, 11);
    floatText(avatar, "SLAIN", "dmg big");
    await pause(620);
  }
}

async function playPlayerCardEvents(events) {
  for (const evt of events) {
    switch (evt.kind) {
      case "enemyDamage":
        await animateEnemyHit(evt);
        break;
      case "playerBlock":
        spawnShield(`+${evt.amount}`);
        setPlayerBars();
        await pause(240);
        break;
      case "playerHeal":
        floatText(playerAvatarEl(), `+${evt.amount}`, "heal");
        spawnHealParticles();
        setPlayerBars();
        await pause(240);
        break;
      case "playerRad":
        floatText(playerAvatarEl(), `+${evt.amount}☢`, "rad");
        spawnRadPulse();
        setPlayerBars();
        await pause(420); // let the hazard pulse read
        break;
      case "playerEnergy":
        floatText(energyAnchor(), `+${evt.amount}⚡`, "energy");
        flashEl(energyAnchor(), "energy-flash", 350);
        setPlayerBars();
        await pause(200);
        break;
      case "playerBuff":
        floatText(playerAvatarEl(), `+${evt.amount} ${evt.stat}`, "buff");
        spawnBuffFx();
        setPlayerBars();
        await pause(340); // beat so the stat gain registers
        break;
      case "autoBlock":
        floatText(playerAvatarEl(), `+${evt.amount} AUTO-BLOCK`, "block");
        spawnAutoBlockFx();
        setPlayerBars();
        await pause(360);
        break;
      case "powerPlayed":
        floatText(playerAvatarEl(), evt.name, "power");
        spawnAt(playerAvatarEl(), "power-ring", 620);
        await pause(320);
        break;
      case "cardsDrawn":
        animateDrawFly(evt.count);
        await pause(140 + evt.count * 60);
        break;
      default:
        break;
    }
  }
}
