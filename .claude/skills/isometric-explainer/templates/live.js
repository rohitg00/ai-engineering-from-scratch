const svg = document.querySelector("[data-ie-svg]");
const layer = svg.querySelector("[data-layer]");
const stage = document.querySelector("[data-ie-stage]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const $ = (selector) => document.querySelector(selector);
const live = (name) => svg.querySelector(`[data-live="${name}"]`);
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const nodes = {};
const meta = {};
D.items.forEach((item) => {
  meta[item.id] = item;
  nodes[item.id] = layer.querySelector(`:scope > g[data-i="${item.id}"]`);
});

const freshPose = () => ({ x: D.STOPS.intake, probe: 0, head: 0, hits: 0, stored: 0, served: 0, hot: [] });

function beatsFor(sim) {
  const beats = [];
  let served = 0;
  const b = (d, to, hot, start) => beats.push({ d, to, hot, start });
  const travel = (station) => beats.push({ d: 0, to: { x: D.STOPS[station] }, hot: ["carriage"], travel: true });
  sim.events.forEach((ev, index) => {
    const mark = beats.length;
    if (ev.type === "intake") {
      travel("intake");
      b(0.3, {}, ["intake", "carriage"]);
    } else if (ev.type === "lookup") {
      travel("cache");
      b(0.35, { probe: -2.5 }, ["probe", "carriage"]);
      b(0.3, {}, ["probe", "gauge"], (pose) => (pose.hits = ev.hits));
      b(0.35, { probe: 0 }, ["probe"]);
    } else if (ev.type === "bypass") {
      travel("cache");
      b(0.4, {}, ["carriage"]);
    } else if (ev.type === "fetch") {
      travel("origin");
      b(0.4, { head: -5 }, ["head", "carriage"]);
      b(0.5, {}, ["head", "carriage"]);
      b(0.4, { head: 0 }, ["head"]);
    } else if (ev.type === "store") {
      const n = ev.stored.length;
      b(0.45, {}, [`bin${n - 1}`], (pose) => (pose.stored = n));
    } else if (ev.type === "exit") {
      served += 1;
      const n = served;
      travel("exit");
      b(0.4, {}, [`tray${n - 1}`], (pose) => (pose.served = n));
    }
    beats[mark].event = index;
  });
  return beats;
}

const state = { config: M.decode(location.search), sim: null, beats: [], bi: 0, bt: 0, pose: null, playing: false, stopAt: -1, shown: -1, done: false, explode: { target: 0, shares: {} } };
Object.keys(D.EXPLODE).forEach((asm) => (state.explode.shares[asm] = { x: 0, v: 0 }));

function writeUrl() {
  const params = new URLSearchParams(M.encode(state.config));
  if (document.documentElement.classList.contains("iso-nolabels")) params.set("labels", "0");
  const query = params.toString();
  history.replaceState(null, "", location.pathname + (query ? "?" + query : "") + location.hash);
}

function load(config, { autoplay = false } = {}) {
  state.config = M.configOf(config);
  state.sim = M.simulate(state.config);
  state.beats = beatsFor(state.sim);
  Object.assign(state, { pose: freshPose(), bi: 0, bt: 0, shown: -1, done: false, stopAt: -1 });
  $("#ie-cache").checked = state.config.cache;
  writeUrl();
  readouts(null);
  draw();
  autoplay ? play() : pause();
}

function begin(beat) {
  if (beat.event !== undefined) onEvent(beat.event);
  if (beat.start) beat.start(state.pose);
  beat._from = {};
  for (const key of Object.keys(beat.to)) beat._from[key] = state.pose[key];
  beat._dur = beat.travel ? 0.3 + Math.abs(beat.to.x - state.pose.x) / 90 : beat.d;
  state.pose.hot = beat.hot;
}
function apply(beat, t) {
  for (const [key, target] of Object.entries(beat.to)) state.pose[key] = lerp(beat._from[key], target, ease(t));
}

function advance(dt) {
  let left = dt;
  while (left > 0 && state.bi < state.beats.length) {
    const beat = state.beats[state.bi];
    if (state.bt === 0) {
      if (state.stopAt >= 0 && beat.event > state.stopAt) {
        state.playing = false;
        state.stopAt = -1;
        sync();
        return;
      }
      begin(beat);
    }
    const remaining = beat._dur - state.bt;
    if (left >= remaining) {
      apply(beat, 1);
      left -= remaining;
      state.bi += 1;
      state.bt = 0;
    } else {
      state.bt += left;
      apply(beat, state.bt / beat._dur);
      left = 0;
    }
  }
  if (state.bi >= state.beats.length && !state.done) {
    state.done = true;
    state.playing = false;
    const t = state.sim.totals;
    $("[data-ie-live]").textContent = `Run finished: ${t.hits} hits, ${t.fetches} origin fetches, ${t.clock} ms simulated.`;
    sync();
  }
}

function onEvent(index) {
  state.shown = index;
  readouts(state.sim.events[index]);
}
function readouts(ev) {
  $("[data-ie-stage-name]").textContent = ev ? ev.trace : "ready";
  $("[data-ie-steps]").textContent = ev ? `${ev.index + 1} / ${state.sim.events.length}` : `0 / ${state.sim.events.length}`;
  $("[data-ie-hits]").textContent = state.config.cache ? String(ev ? ev.hits : 0) : "cache off";
  $("[data-ie-fetches]").textContent = String(ev ? ev.fetches : 0);
  $("[data-ie-clock]").textContent = `${ev ? ev.clock : 0} ms`;
}

let lastOrder = "";
let lastPills = "";
function draw() {
  const pose = state.pose;
  const T = {};
  for (const item of D.items) {
    const share = item.id.startsWith("tag-") ? null : state.explode.shares[item.asm];
    T[item.id] = mul(D.EXPLODE[item.asm], share ? share.x : 0);
  }
  T.carriage = add(T.carriage, [pose.x, 0, 0]);
  T.probe = add(T.probe, [0, 0, pose.probe]);
  T.head = add(T.head, [0, 0, pose.head]);

  const keyed = D.items.map((item) => [item.id, item.key + dot(T[item.id], D.V)]).sort((a, b) => a[1] - b[1]);
  for (const item of D.items) {
    const t = T[item.id];
    const text = t[0] || t[1] || t[2] ? K.translateAlong(D.P, t) : "";
    if (nodes[item.id]._t !== text) {
      text ? nodes[item.id].setAttribute("transform", text) : nodes[item.id].removeAttribute("transform");
      nodes[item.id]._t = text;
    }
  }
  const order = keyed.map((entry) => entry[0]).join(",");
  if (order !== lastOrder) {
    const fragment = document.createDocumentFragment();
    keyed.forEach(([id]) => fragment.appendChild(nodes[id]));
    layer.appendChild(fragment);
    lastOrder = order;
  }

  for (let i = 0; i < 3; i++) {
    live(`bin${i}`).style.display = i < pose.stored ? "" : "none";
    live(`tray${i}`).style.display = i < pose.served ? "" : "none";
  }
  const [rx, ry, top, rest] = D.ROD;
  live("rod").setAttribute("d", K.segment([rx, ry, top], [rx, ry, rest + pose.head], D.P));
  const [cx, cy, cz] = D.DIAL;
  const a = -0.75 * Math.PI + (pose.hits / 3) * 1.5 * Math.PI;
  live("needle").setAttribute("d", K.lineOnTop([cx, cy], [cx + Math.sin(a) * 4.4, cy - Math.cos(a) * 4.4], cz, D.P));

  const hot = new Set(pose.hot);
  for (const id of Array.from(hot)) if (meta[id]) hot.add(`tag-${meta[id].asm}`);
  const pills = D.LABELS.map((label) => Ink.pillSvg(K.iso(add(label.at, mul(D.EXPLODE[label.asm], state.explode.shares[label.asm].x)), D.P), label.dx, label.dy, D.CONCEPT[label.asm], pose.hot.some((id) => meta[id] && meta[id].asm === label.asm))).join("");
  if (pills !== lastPills) svg.querySelector("[data-pills]").innerHTML = lastPills = pills;
  for (const item of D.items) {
    const node = nodes[item.id];
    hot.has(item.id) ? node.setAttribute("data-hot", "") : node.removeAttribute("data-hot");
    item.asm === "cache" && !state.config.cache ? node.setAttribute("data-off", "") : node.removeAttribute("data-off");
  }
}

const SPRING = { stiffness: 64, damping: 14.2, stagger: 0.04 };
function stepExplode(dt) {
  let moving = false;
  Object.values(state.explode.shares).forEach((share, index) => {
    const goal = state.explode.target;
    if (still.matches) return Object.assign(share, { x: goal, v: 0 });
    if (share.goal !== goal) Object.assign(share, { goal, wait: index * SPRING.stagger });
    if (share.wait > 0) return (share.wait -= dt), (moving = true);
    for (let i = 0; i < 4; i++) {
      share.v += (SPRING.stiffness * (goal - share.x) - SPRING.damping * share.v) * (dt / 4);
      share.x += share.v * (dt / 4);
    }
    if (Math.abs(goal - share.x) < 5e-4 && Math.abs(share.v) < 5e-4) Object.assign(share, { x: goal, v: 0 });
    else moving = true;
  });
  return moving;
}

let frame = 0;
let last = 0;
let visible = true;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
  last = now;
  if (state.playing) advance(dt * (still.matches ? 40 : 1));
  const moving = stepExplode(dt);
  draw();
  frame = visible && (state.playing || moving) ? requestAnimationFrame(tick) : 0;
  if (!frame) last = 0;
}
function wake() {
  if (!frame && visible) frame = requestAnimationFrame(tick);
}
new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) wake();
}, { rootMargin: "120px 0px" }).observe(stage);

function play() {
  if (state.done) load(state.config);
  state.stopAt = -1;
  state.playing = true;
  state.explode.target = 0;
  sync();
  wake();
}
function pause() {
  state.playing = false;
  sync();
  wake();
}
function step() {
  if (state.done) load(state.config);
  state.explode.target = 0;
  state.stopAt = state.shown + 1;
  state.playing = true;
  sync();
  wake();
}
function toggleExplode() {
  state.explode.target = state.explode.target ? 0 : 1;
  if (state.explode.target) state.playing = false;
  sync();
  wake();
}
function sync() {
  const run = $("[data-ie-run]");
  run.textContent = state.playing ? "Pause" : state.done ? "Run again" : state.shown >= 0 ? "Resume" : "Run";
  run.setAttribute("aria-pressed", String(state.playing));
  $("[data-ie-explode]").setAttribute("aria-pressed", String(Boolean(state.explode.target)));
}

$("[data-ie-run]").addEventListener("click", () => (state.playing ? pause() : play()));
$("[data-ie-step]").addEventListener("click", step);
$("[data-ie-break]").addEventListener("click", () => load({ cache: false }, { autoplay: true }));
$("[data-ie-repair]").addEventListener("click", () => load({ cache: true }, { autoplay: true }));
$("[data-ie-explode]").addEventListener("click", toggleExplode);
$("[data-ie-reset]").addEventListener("click", () => {
  state.explode.target = 0;
  load(M.DEFAULTS);
  wake();
});
$("#ie-cache").addEventListener("change", (event) => load({ cache: event.target.checked }, { autoplay: state.shown >= 0 }));
$("[data-ie-theme]").addEventListener("click", () => document.body.setAttribute("data-theme", document.body.getAttribute("data-theme") === "light" ? "dark" : "light"));
stage.addEventListener("keydown", (event) => {
  if (event.target !== stage) return;
  const key = event.key.toLowerCase();
  if (key === " " || key === "enter") state.playing ? pause() : play();
  else if (key === "arrowright") step();
  else if (key === "e") toggleExplode();
  else if (key === "b") load({ cache: false }, { autoplay: true });
  else if (key === "r") load({ cache: true }, { autoplay: true });
  else return;
  event.preventDefault();
});

function setWobble(value) {
  svg.querySelector("[data-wobble]").setAttribute("scale", String(value));
  value > 0 ? layer.setAttribute("filter", "url(#iso-hand)") : layer.removeAttribute("filter");
}
$("#ie-wobble").addEventListener("input", (event) => setWobble(Number(event.target.value)));
function setLabels(on) {
  document.documentElement.classList.toggle("iso-nolabels", !on);
  $("#ie-labels").checked = on;
  writeUrl();
}
$("#ie-labels").addEventListener("change", (event) => setLabels(event.target.checked));
if (new URLSearchParams(location.search).get("labels") === "0") document.documentElement.classList.add("iso-nolabels"), ($("#ie-labels").checked = false);
window.__machine = { state, load, play, pause, step, toggleExplode, seek: (n) => ((state.stopAt = n), (state.playing = true), advance(1e6), (state.playing = false), draw()), finish: () => ((state.playing = true), advance(1e6), draw()) };
load(state.config);
if (!still.matches && !/[?&]still\b/.test(location.search)) setTimeout(() => state.shown < 0 && play(), 900);
