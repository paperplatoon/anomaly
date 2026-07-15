// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// Small DOM + misc helpers used everywhere. No game logic here.
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

// Create an element with classes/text/attrs/children in one call.
//   el("button", { class: "primary", text: "Go", onClick: fn })
//   el("div", { class: ["a","b"] }, [childEl, "some text"])
function el(tag, opts = {}, children = []) {
  const node = document.createElement(tag);

  if (opts.class) {
    const classes = Array.isArray(opts.class) ? opts.class : [opts.class];
    classes
      .filter(Boolean)
      .forEach((c) => String(c).split(/\s+/).filter(Boolean).forEach((t) => node.classList.add(t)));
  }
  if (opts.text != null) node.textContent = opts.text;
  if (opts.html != null) node.innerHTML = opts.html;
  if (opts.id) node.id = opts.id;
  if (opts.onClick) node.addEventListener("click", opts.onClick);
  if (opts.onMouseEnter) node.addEventListener("mouseenter", opts.onMouseEnter);
  if (opts.onMouseLeave) node.addEventListener("mouseleave", opts.onMouseLeave);
  if (opts.attrs) {
    Object.entries(opts.attrs).forEach(([k, v]) => node.setAttribute(k, v));
  }

  const kids = Array.isArray(children) ? children : [children];
  kids.filter((c) => c != null).forEach((c) => {
    node.append(typeof c === "string" ? document.createTextNode(c) : c);
  });

  return node;
}

// Empty the root and return it.
function clearApp() {
  const app = document.getElementById("app");
  app.innerHTML = "";
  return app;
}

// Promise-based pause for animations (used in later chunks).
function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Random integer in [min, max] inclusive.
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Fisher-Yates shuffle returning a new array.
function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Monotonically increasing id source for card instances, etc.
let _idCounter = 0;
function nextId(prefix = "id") {
  _idCounter += 1;
  return `${prefix}_${_idCounter.toString().padStart(4, "0")}`;
}
