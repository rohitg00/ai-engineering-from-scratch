const svg = document.querySelector("[data-dm-svg]");
const layer = svg.querySelector("[data-layer]");
const stage = document.querySelector("[data-dm-stage]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const P = Pt.P;
D.P = Pt.P;
D.V = Pt.V;
D.XS = Pt.XS;
D.HOME_X = Pt.HOME_X;
D.RAIL_Y = Pt.RAIL_Y;
D.HEAD = Pt.HEAD;
D.STACK = Pt.STACK;
D.BED = Pt.BED;
D.STAGES = M.STAGES;
D.INFO = C.INFO;
D.CONCEPT = C.CONCEPT;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const STATIONS = D.STAGES;

const nodes = {};
const meta = {};
D.items.forEach((item) => {
  meta[item.id] = item;
  nodes[item.id] = layer.querySelector(`:scope > g[data-i="${item.id}"]`);
});
const live = (name) => svg.querySelector(`[data-live="${name}"]`);
const escapeHtml = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const breakable = (text) => escapeHtml(text).replace(/([(,])/g, "$1<wbr>").replace(/(-O\d)/g, '<span class="dm-nobr">$1</span>');

function freshPose() {
  const pose = { lamps: {}, cx: D.HOME_X, plates: 0, drawer: 0, lock: 0, cursor: 0, tiles: 0, marks: 0, blocks: 0, edges: 0, dead: 0, ir: 0, bolt: 0, pins: 0, jawA: 0, jawB: 0, printed: 0, trays: [0, 0, 0, 0], hot: [] };
  STATIONS.forEach((name) => (pose["h_" + name] = 0));
  return pose;
}

const variants = {};
function variantOf(config) {
  const id = `${M.keyOf(config)}|${config.symbols ? "named" : "stripped"}|${config.sweep}`;
  if (variants[id]) return variants[id];
  const sim = M.simulate(config);
  const ev = sim.events.find((event) => event.type === "decode");
  const { run, descent } = M.decodeOf(config);
  const data = { range: ev.range, insns: ev.insns, reached: descent.insns.map((insn) => insn.a), missed: ev.missed, descentInsns: descent.insns, conflict: ev.conflict };
  const pos = Pt.graphLayout(run);
  const liveOrder = run.blocks.filter((block) => block.live).map((block) => block.s).sort((a, b) => pos[a][1] - pos[b][1] || pos[a][0] - pos[b][0]);
  const cursor = Object.fromEntries(ev.insns.map((insn) => [insn.a, Pt.cursorX(data, insn.a + insn.n / 2)]));
  const deadCount = run.blocks.filter((block) => !block.live).length;
  return (variants[id] = { tiles: Pt.tilesSvg(data), graph: Pt.graphSvg(run), bin: Pt.binSvg(deadCount), liveOrder, deadCount, cursor });
}
const programs = {};
function programOf(config) {
  const key = M.keyOf(config);
  if (programs[key]) return programs[key];
  const fx = F.FIXTURE[key];
  const lift = fx.lift;
  const lines = lift.error ? [] : lift.pseudocode;
  const ir = lift.error ? 0 : lift.irCount;
  return (programs[key] = { ir, irSvg: Pt.irSvg(ir), pins: lift.error ? 0 : lift.params.length + lift.locals.length + 1, lines, sheets: {}, bytes: fx.fileBytes });
}

function beatsFor(sim) {
  const beats = [];
  const b = (d, to = {}, extra = {}) => beats.push({ d, to, ...extra });
  const travel = (station) => beats.push({ d: "travel", to: { cx: D.XS[station] }, hot: ["carriage"] });
  let plates = 0;
  const pressDown = (station, depth = 1) => b(0.4, { ["h_" + station]: depth }, { hot: [station, "carriage"] });
  const pressUp = (station) => b(0.3, { ["h_" + station]: 0 }, { hot: [station] });
  const stamp = (station) => {
    pressDown(station);
    plates += 1;
    const n = plates;
    b(0.18, {}, { hot: [station, "carriage"], start: (pose) => ((pose.plates = n), (pose.lamps[station] = pose.lamps[station] || "ok")) });
    pressUp(station);
  };
  const variant = variantOf(sim.config);
  sim.events.forEach((ev, index) => {
    const mark = beats.length;
    const tally = M.tallyOf(ev.ledger);
    const file = () => b(0.12, {}, { hot: [ev.station, "ledger"], start: (pose) => (pose.trays = M.CONFIDENCE.map((kind) => tally[kind])) });
    switch (ev.type) {
      case "header":
        travel("header");
        pressDown("header", 0.55);
        b(0.6, {}, { hot: ["header"] });
        file();
        pressUp("header");
        stamp("header");
        break;
      case "sections":
        travel("sections");
        b(0.55, { drawer: 1 }, { hot: ["sections"] });
        if (ev.locked) b(0.4, {}, { hot: ["sections"], start: (pose) => ((pose.lock = 1), (pose.lamps.sections = "bad")) });
        file();
        stamp("sections");
        b(0.4, { drawer: 0 }, { hot: ["sections"] });
        break;
      case "decode": {
        travel("disasm");
        const order = ev.order;
        const per = Math.max(1, Math.ceil(order.length / 14));
        for (let i = 0; i < order.length; i += per) {
          const count = Math.min(order.length, i + per);
          const address = order[count - 1];
          b(0.16, { cursor: variant.cursor[address] }, { hot: ["disasm"], end: (pose) => (pose.tiles = count) });
        }
        if (ev.missed.length || ev.conflict) b(0.5, {}, { hot: ["disasm"], start: (pose) => (pose.marks = 1) });
        if (ev.extra.length || ev.conflict) b(0.2, {}, { hot: ["disasm"], start: (pose) => (pose.lamps.disasm = "bad") });
        file();
        stamp("disasm");
        break;
      }
      case "cfg": {
        travel("cfg");
        const live = variant.liveOrder;
        live.forEach((_, i) => b(0.22, {}, { hot: ["cfg"], start: (pose) => (pose.blocks = i + 1) }));
        b(0.3, {}, { hot: ["cfg"], start: (pose) => (pose.edges = 1) });
        if (variant.deadCount) b(0.3, {}, { hot: ["cfg"], start: (pose) => (pose.dead = 1) });
        file();
        stamp("cfg");
        break;
      }
      case "prune":
        b(0.5, {}, { hot: ["cfg"], start: (pose) => (pose.dead = 2) });
        file();
        break;
      case "lift": {
        travel("lift");
        pressDown("lift");
        const n = programOf(sim.config).ir;
        const per = Math.max(1, Math.ceil(n / 8));
        for (let i = per; i < n + per; i += per) {
          const count = Math.min(n, i);
          b(0.12, {}, { hot: ["lift"], start: (pose) => (pose.ir = count) });
        }
        file();
        plates += 1;
        const plated = plates;
        b(0.18, {}, { hot: ["lift", "carriage"], start: (pose) => ((pose.plates = plated), (pose.lamps.lift = "ok")) });
        pressUp("lift");
        break;
      }
      case "refuse":
        travel("lift");
        pressDown("lift", 0.45);
        b(0.6, { bolt: 1 }, { hot: ["lift"], start: (pose) => (pose.lamps.lift = "bad") });
        file();
        pressUp("lift");
        break;
      case "types": {
        travel("types");
        const n = programOf(sim.config).pins;
        for (let i = 0; i < n; i++) b(0.16, {}, { hot: ["types"], start: (pose) => (pose.pins = i + 1) });
        file();
        stamp("types");
        break;
      }
      case "structure":
        travel("structure");
        b(0.55, ev.shape === "if-else" ? { jawA: 1, jawB: 1 } : { jawA: 1 }, { hot: ["structure"] });
        file();
        stamp("structure");
        break;
      case "emit": {
        travel("pseudocode");
        ev.lines.forEach((_, i) => b(0.11, {}, { hot: ["pseudocode"], start: (pose) => (pose.printed = i + 1) }));
        file();
        stamp("pseudocode");
        break;
      }
      case "ledger":
        travel("ledger");
        file();
        stamp("ledger");
        break;
      case "exit":
        b(0.5, {}, { hot: ["ledger"], start: (pose) => (pose.lamps.ledger = sim.outcome.status === "decompiled" ? "ok" : "bad") });
        break;
    }
    beats[mark].event = index;
    for (let i = mark; i < beats.length; i++) beats[i].sound = beats[i].d === "travel" ? "whirr" : C.STEPS[ev.type].sound;
  });
  return beats;
}

function durationsOf(beats) {
  const out = [];
  let cx = D.HOME_X;
  let current = 0;
  for (const beat of beats) {
    if (beat.event !== undefined) current = beat.event;
    let d = beat.d;
    if (d === "travel") {
      d = Math.min(1.3, 0.35 + Math.abs(beat.to.cx - cx) / 150);
      cx = beat.to.cx;
    }
    out[current] = (out[current] || 0) + d;
  }
  return out;
}

const startParams = new URLSearchParams(location.search);
const renderMode = startParams.has("render");
if (renderMode) document.documentElement.setAttribute("data-render", "");
let mode = "manual";
try {
  if (!renderMode && localStorage.getItem("dm-mode") === "auto") mode = "auto";
} catch (error) {}
const startPalette = startParams.get("pal");
const state = { config: M.decode(location.search), sim: null, beats: [], bi: 0, bt: 0, pose: null, playing: false, stopAt: -1, shown: -1, done: false, speed: 1, selected: null, explode: { target: 0, shares: {} } };
D.ASSEMBLIES.forEach((asm) => (state.explode.shares[asm] = { x: 0, v: 0 }));

let replayTimer = 0;
function load(config, { autoplay = false } = {}) {
  clearTimeout(replayTimer);
  state.config = M.configOf(config);
  state.sim = M.simulate(state.config);
  state.beats = beatsFor(state.sim);
  state.durations = durationsOf(state.beats);
  state.variant = variantOf(state.config);
  state.program = programOf(state.config);
  state.order = state.sim.events.find((event) => event.type === "decode").order;
  Object.assign(state, { pose: freshPose(), bi: 0, bt: 0, shown: -1, done: false, stopAt: -1 });
  live("tiles").innerHTML = state.variant.tiles;
  const fx = F.FIXTURE[M.keyOf(state.config)];
  live("drawers").innerHTML = Pt.drawersSvg(fx.sections);
  state.textDrawer = live("drawers").querySelector('[data-name=".text"]');
  live("elfline").innerHTML = Pt.frontText(D.XS.header, Pt.CARD.y1, Pt.CARD.z1 - 24, `E_SHNUM ${fx.header.shnum}`, 3.2);
  live("slots").innerHTML = Pt.slotsSvg(Pt.slotList(fx.lift));
  state.decode = state.sim.events.find((event) => event.type === "decode");
  lastLanes = "";
  live("graph").innerHTML = state.variant.graph;
  live("bin").innerHTML = state.variant.bin;
  live("irstack").innerHTML = state.program.irSvg;
  live("bin").style.display = "none";
  lastSheet = -1;
  lastDrawer = -1;
  buildSteps();
  syncControls();
  writeUrl();
  render(-1);
  draw();
  autoplay ? play() : pause();
}

function begin(beat) {
  if (beat.event !== undefined) onEvent(beat.event);
  if (beat.start) beat.start(state.pose);
  beat._from = {};
  for (const key of Object.keys(beat.to)) beat._from[key] = state.pose[key];
  beat._dur = beat.d === "travel" ? Math.min(1.3, 0.35 + Math.abs(beat.to.cx - state.pose.cx) / 150) : beat.d;
  state.pose.hot = beat.hot || [];
  state.pose.sound = beat.sound || "";
}
function apply(beat, t) {
  for (const [key, target] of Object.entries(beat.to)) state.pose[key] = lerp(beat._from[key], target, ease(t));
}

function advance(dt) {
  let left = dt;
  while (left > 0 && state.bi < state.beats.length) {
    const beat = state.beats[state.bi];
    if (state.bt === 0) {
      if (state.stopAt >= 0 && beat.event !== undefined && beat.event > state.stopAt) {
        state.playing = false;
        state.stopAt = -1;
        state.pose.sound = "";
        syncButtons();
        return;
      }
      begin(beat);
    }
    const remaining = beat._dur - state.bt;
    if (left >= remaining) {
      apply(beat, 1);
      if (beat.end) beat.end(state.pose);
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
    state.pose.hot = [];
    state.pose.sound = "";
    render(state.sim.events.length - 1);
    if (mode === "auto" && !renderMode) replayTimer = setTimeout(() => mode === "auto" && state.done && load(state.config, { autoplay: true }), 1800);
    const o = state.sim.outcome;
    const t = state.sim.totals;
    $("[data-dm-live]").textContent = `Run finished: ${o.status}. ${t.observed} observed, ${t.derived} derived, ${t.inferred} inferred, ${t.unknown} unknown.`;
    syncButtons();
  }
}

function onEvent(index) {
  state.shown = index;
  render(index);
}

const dropOf = (pose) => D.HEAD.home - (D.STACK.z0 + Math.min(pose.plates, 8) * D.STACK.step + D.STACK.t);
let lastOrder = "";
let lastPills = "";
const pillLayer = svg.querySelector("[data-pills]");
const sfxLayer = svg.querySelector("[data-sfx]");
let lastSfx = "";
let lastSteps = "";
let lastGuide = "";
let lastSheet = -1;
let lastDrawer = -1;
let lastLanes = "";
function windowOf(visited) {
  const ev = state.decode;
  const start = ev.range[0];
  const at = visited > 0 ? ev.order[visited - 1] : ev.order[0];
  return start + Math.floor((at - start) / 16) * 16;
}
const laneKey = (visited) => `${windowOf(visited)}|${visited}`;
function laneStates(visited) {
  const ev = state.decode;
  const base = windowOf(visited);
  const seen = new Set(ev.order.slice(0, visited));
  const extra = new Set(ev.extra);
  return Array.from({ length: 16 }, (_, i) => {
    const b = base + i;
    if (b >= ev.range[1]) return "none";
    const index = ev.insns.findIndex((insn) => insn.a <= b && b < insn.a + insn.n);
    if (index < 0) return "gap";
    const insn = ev.insns[index];
    if (!seen.has(insn.a)) return "wait";
    if (extra.has(insn.a)) return "x";
    return index % 2 ? "b" : "a";
  });
}
const rodCache = {};
function draw() {
  const pose = state.pose;
  const T = {};
  for (const item of D.items) {
    const share = item.id.startsWith("tag-") ? null : state.explode.shares[item.asm];
    T[item.id] = mul(D.EXPLODE[item.asm], share ? share.x : 0);
  }
  const ride = [pose.cx - D.HOME_X, 0, 0];
  for (const item of D.items) if (item.asm === "carriage") T[item.id] = add(T[item.id], ride);
  for (const name of STATIONS) {
    const drop = Math.round(pose["h_" + name] * dropOf(pose) * 4) / 4;
    T[`${name}-head`] = add(T[`${name}-head`], [0, 0, -drop]);
  }
  T.cursor = add(T.cursor, [pose.cursor - (D.XS.disasm - D.BED.half), 0, 0]);
  T["jaw-a"] = add(T["jaw-a"], [pose.jawA * 4.2, 0, 0]);
  T["jaw-b"] = add(T["jaw-b"], [-pose.jawB * 4.2, 0, 0]);
  T.bolt = add(T.bolt, [(1 - pose.bolt) * -30, 0, 0]);

  for (const item of D.items) {
    const t = T[item.id];
    const text = t[0] || t[1] || t[2] ? K.translateAlong(P, t) : "";
    if (nodes[item.id]._t !== text) {
      text ? nodes[item.id].setAttribute("transform", text) : nodes[item.id].removeAttribute("transform");
      nodes[item.id]._t = text;
    }
  }
  const keyed = D.items.map((item) => [item.id, item.key + dot(T[item.id], D.V)]).sort((a, b) => a[1] - b[1]);
  const order = keyed.map((entry) => entry[0]).join(",");
  if (order !== lastOrder) {
    const fragment = document.createDocumentFragment();
    keyed.forEach(([id]) => fragment.appendChild(nodes[id]));
    layer.appendChild(fragment);
    lastOrder = order;
  }

  for (const name of STATIONS) {
    const drop = Math.round(pose["h_" + name] * dropOf(pose) * 4) / 4;
    const node = live(`rod-${name}`);
    if (node._k === drop) continue;
    node._k = drop;
    const x = D.XS[name];
    const key = `${name}|${drop}`;
    const z0 = D.HEAD.home + D.HEAD.h - drop - 0.2;
    node.setAttribute("d", rodCache[key] || (rodCache[key] = K.segment([x - 2, D.RAIL_Y, z0], [x - 2, D.RAIL_Y, D.HEAD.armZ], P) + K.segment([x + 2, D.RAIL_Y, z0], [x + 2, D.RAIL_Y, D.HEAD.armZ], P)));
  }
  const open = Math.round(pose.drawer * 18) / 2;
  if (open !== lastDrawer && state.textDrawer) {
    open ? state.textDrawer.setAttribute("transform", K.translateAlong(P, [0, open, 0])) : state.textDrawer.removeAttribute("transform");
    state.textDrawer.querySelector("[data-tray]").style.display = open > 0.4 ? "" : "none";
    lastDrawer = open;
  }
  const lanesKey = laneKey(pose.tiles);
  if (lanesKey !== lastLanes) {
    live("lanes").innerHTML = Pt.lanesSvg(laneStates(pose.tiles));
    lastLanes = lanesKey;
  }
  live("lock").style.display = pose.lock ? "" : "none";
  const tiles = live("tiles");
  const visited = new Set(state.order.slice(0, pose.tiles));
  tiles.querySelectorAll("[data-tile]").forEach((node) => (node.style.display = visited.has(Number(node.dataset.addr)) ? "" : "none"));
  tiles.querySelectorAll("[data-missed], [data-conflict]").forEach((node) => (node.style.display = pose.marks ? "" : "none"));
  const graph = live("graph");
  state.variant.liveOrder.forEach((start, i) => {
    const node = graph.querySelector(`[data-block="${start}"]`);
    if (node) node.style.display = i < pose.blocks ? "" : "none";
  });
  const edges = graph.querySelector("[data-edges]");
  if (edges) edges.style.display = pose.edges ? "" : "none";
  const count = graph.querySelector("[data-count]");
  if (count) count.style.display = pose.edges ? "" : "none";
  const dead = graph.querySelector("[data-dead]");
  if (dead) dead.style.display = pose.dead === 1 ? "" : "none";
  live("bin").style.display = pose.dead === 2 ? "" : "none";
  live("irstack").querySelectorAll("[data-ir]").forEach((node, i) => (node.style.display = i < pose.ir ? "" : "none"));
  live("bolt").style.display = pose.bolt > 0.01 ? "" : "none";
  live("slots").querySelectorAll("[data-pin]").forEach((node) => (node.style.display = Number(node.dataset.pin) < pose.pins ? "" : "none"));
  if (pose.printed !== lastSheet) {
    const sheets = state.program.sheets;
    live("sheet").innerHTML = sheets[pose.printed] === undefined ? (sheets[pose.printed] = Pt.sheetSvg(state.program.lines, pose.printed)) : sheets[pose.printed];
    lastSheet = pose.printed;
  }
  pose.trays.forEach((count, i) => live(`tray${i}`).querySelectorAll("[data-card]").forEach((node, j) => (node.style.display = j < count ? "" : "none")));
  for (let i = 0; i < 9; i++) live(`card${i}`).style.display = i < pose.plates ? "" : "none";
  for (const name of STATIONS) {
    const lampNode = live(`lamp-${name}`);
    const wanted = pose.lamps[name] || "";
    if (lampNode.dataset.state !== wanted) lampNode.dataset.state = wanted;
  }

  const hot = new Set(pose.hot);
  if (state.selected) hot.add(state.selected);
  const pills = D.LABELS.map((label) => Pt.pillSvg(K.iso(add(label.at, T[label.asm]), P), label.dx, label.dy, D.CONCEPT[label.asm], hot.has(label.asm))).join("");
  if (pills !== lastPills) {
    pillLayer.innerHTML = pills;
    lastPills = pills;
  }
  const spot = K.iso([pose.cx + 14, 46, 0], P).map((v) => v.toFixed(1));
  const sfx = pose.sound ? `<text class="dm-sfx" x="${spot[0]}" y="${spot[1]}" transform="rotate(-8 ${spot.join(" ")})">${pose.sound}</text>` : "";
  if (sfx !== lastSfx) {
    sfxLayer.innerHTML = sfx;
    lastSfx = sfx;
  }
  syncSteps();
  syncGuide();
  const off = state.config.program === "trap" ? new Set(["types", "structure", "pseudocode"]) : new Set();
  for (const item of D.items) {
    const node = nodes[item.id];
    hot.has(item.asm) ? node.setAttribute("data-hot", "") : node.removeAttribute("data-hot");
    off.has(item.asm) ? node.setAttribute("data-off", "") : node.removeAttribute("data-off");
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
  if (state.playing) advance(dt * state.speed * (still.matches ? 40 : 1));
  const moving = stepExplode(dt);
  draw();
  frame = visible && (state.playing || moving) ? requestAnimationFrame(tick) : 0;
  if (!frame) last = 0;
}
function kick() {
  if (renderMode) return draw();
  if (!frame && visible) frame = requestAnimationFrame(tick);
}
new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) kick();
}, { rootMargin: "120px 0px" }).observe(stage);

function play() {
  if (state.done) load(state.config);
  state.stopAt = -1;
  state.playing = true;
  state.explode.target = 0;
  syncButtons();
  kick();
}
function pause() {
  state.playing = false;
  syncButtons();
  kick();
}
function step() {
  if (state.done) load(state.config);
  state.explode.target = 0;
  state.stopAt = state.shown + 1;
  state.playing = true;
  syncButtons();
  kick();
}
let breakIndex = 0;
function breakOne() {
  const choice = M.BREAKS[breakIndex % M.BREAKS.length];
  breakIndex += 1;
  load({ ...M.DEFAULTS, ...choice }, { autoplay: true });
  flash(D.BREAK_NOTES[breakIndex - 1 - Math.floor((breakIndex - 1) / M.BREAKS.length) * M.BREAKS.length]);
}
function repair() {
  load(M.DEFAULTS, { autoplay: true });
  flash("Repaired: -O2, symbols read, recursive descent.");
}
function toggleExplode() {
  state.explode.target = state.explode.target ? 0 : 1;
  if (state.explode.target) state.playing = false;
  syncButtons();
  kick();
}

function buildSteps() {
  const list = $("[data-dm-steplist]");
  list.innerHTML = state.sim.events.map((ev, i) => `<li><button type="button" class="dm-stepbtn" data-dm-n="${i}" data-state="wait" disabled><span class="dm-num">${i + 1}</span><span class="dm-step-l">${escapeHtml(C.STEPS[ev.type].label)}</span></button></li>`).join("");
  list.querySelectorAll("[data-dm-n]").forEach((button) =>
    button.addEventListener("click", () => {
      if (Number(button.dataset.dmN) === state.shown + 1 && !state.playing) step();
    }),
  );
  lastSteps = "";
}
function syncSteps() {
  const key = `${state.shown}|${state.playing}|${state.bt > 0}|${state.done}|${mode}|${state.sim.events.length}`;
  if (key === lastSteps) return;
  lastSteps = key;
  $$("[data-dm-n]").forEach((button) => {
    const i = Number(button.dataset.dmN);
    const busy = state.shown >= 0 && !state.done && (state.playing || state.bt > 0);
    const running = i === state.shown && busy;
    const finished = i < state.shown || (i === state.shown && !running);
    const next = mode === "manual" && !busy && !state.done && i === state.shown + 1;
    button.dataset.state = running ? "running" : finished ? "done" : next ? "next" : "wait";
    button.disabled = !next;
    running ? button.setAttribute("aria-current", "step") : button.removeAttribute("aria-current");
  });
  $$("[data-dm-mode]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.dmMode === mode)));
  const list = $("[data-dm-steplist]");
  const focus = list.querySelector('[data-state="running"], [data-state="next"]');
  if (focus && list.scrollWidth > list.clientWidth + 1) list.scrollLeft = focus.parentElement.offsetLeft - list.offsetLeft - 8;
}
function cutOf(ev, pose) {
  const fx = F.FIXTURE[M.keyOf(state.config)];
  const lift = fx.lift;
  const clip = (text, n = 30) => (text.length > n ? text.slice(0, n - 1) + "…" : text);
  const branch = state.decode.insns.find((insn) => insn.flow !== "next" && insn.flow !== "return") || state.decode.insns[0];
  switch (ev.type) {
    case "header":
      return [fx.ident.slice(0, 17), `ELF64 · LSB · ${fx.header.typeName} · ${fx.header.machineName}`];
    case "sections": {
      const text = fx.sections.find((section) => section.name === ".text");
      return [`.text @ ${M.hex(text.offset)}`, `${text.size} bytes of code`];
    }
    case "decode": {
      const at = state.order[Math.max(0, pose.tiles - 1)];
      const insn = ev.insns.find((item) => item.a === at) || ev.insns[0];
      return [insn.hex, insn.text];
    }
    case "cfg":
      return [`${branch.text}`, ev.trace.split(" from ")[0]];
    case "prune":
      return [`no road from ${M.hex(state.decode.range[0])}`, `${ev.dropped} block${ev.dropped === 1 ? "" : "s"} in the bin`];
    case "refuse":
    {
      const m = ev.error.match(/^(0x[0-9a-f]+): .*?opcode ([0-9a-f ]+?) is (.*)$/);
      return m ? [`${m[2]} @ ${m[1]}`, clip(`stop: ${m[3].replace("the fixture ", "")}`)] : [M.hex(state.decode.range[0]), clip(`stop: ${ev.error}`)];
    }
    case "lift": {
      const lines = ev.ir.filter((line) => line.startsWith("  "));
      return [`${ev.decoded} instructions`, clip(lines[Math.max(0, Math.min(lines.length, pose.ir) - 1)].trim())];
    }
    case "types": {
      const slots = Pt.slotList(lift);
      const slot = slots[Math.max(0, Math.min(slots.length, pose.pins) - 1)];
      const type = slot.name === "return" ? lift.returns : [...lift.params, ...lift.locals].find((item) => item.name === slot.name).type;
      return [slot.label, `${slot.name}: ${type}`];
    }
    case "structure":
      return [branch.text, ev.shape];
    case "emit":
      return [`${lift.irCount} IR lines`, clip(ev.lines[Math.max(0, Math.min(ev.lines.length, pose.printed) - 1)].trim())];
    case "ledger": {
      const t = ev.tally;
      return [`${ev.ledger.length} claims`, `${t.observed} obs · ${t.derived} der · ${t.inferred} inf · ${t.unknown} unk`];
    }
    default:
      return [`${ev.ledger.length} claims`, ev.outcome.status];
  }
}
function syncGuide() {
  const sim = state.sim;
  const midStep = state.shown >= 0 && !state.done && (state.playing || state.bt > 0);
  const running = midStep ? sim.events[state.shown] : null;
  const nextEvent = sim.events[state.shown + 1];
  const hint = state.shown < 0 && !state.playing ? C.READY_HINT : running ? C.STEPS[running.type].hint : state.done ? C.STEPS.exit.hint : nextEvent ? C.STEPS[nextEvent.type].hint : "";
  const shownEvent = state.shown >= 0 ? sim.events[state.shown] : null;
  const real = running ? Ck.realOf(state.config, running.type) : null;
  const slow = state.speed * (still.matches && !renderMode ? 40 : 1);
  const badge = running ? Ck.badgeOf(state.durations[state.shown] / slow, real) : null;
  const cut = shownEvent ? cutOf(shownEvent, state.pose) : null;
  const key = [hint, badge && badge.text, cut && cut.join("|"), shownEvent && shownEvent.station].join("#");
  if (key === lastGuide) return;
  lastGuide = key;
  $("[data-dm-hint]").textContent = hint;
  const badgeNode = $("[data-dm-badge]");
  badgeNode.hidden = !badge;
  if (badge) {
    badgeNode.textContent = `${badge.text} · ${badge.real}`;
    badgeNode.title = badge.ratio > 1 ? "Shown slower than the real code runs" : "Shown faster than the real code runs";
  }
  const cutNode = $("[data-dm-cut]");
  cutNode.hidden = !cut;
  if (cut) {
    $("[data-dm-cut-title]").textContent = `Inside: ${D.CONCEPT[shownEvent.station]}`;
    $("[data-dm-cut-cause]").textContent = cut[0];
    $("[data-dm-cut-result]").textContent = cut[1];
  }
}
function setMode(next) {
  mode = next;
  try {
    localStorage.setItem("dm-mode", next);
  } catch (error) {}
  if (mode === "auto" && !state.playing) play();
  if (mode === "manual" && state.playing) pause();
  lastSteps = "";
  draw();
}
$$("[data-dm-mode]").forEach((button) => button.addEventListener("click", () => setMode(button.dataset.dmMode)));
$("[data-dm-restart]").addEventListener("click", (event) => {
  event.preventDefault();
  state.explode.target = 0;
  load(state.config, { autoplay: mode === "auto" });
});
function seekTime(t) {
  Object.values(state.explode.shares).forEach((share) => Object.assign(share, { x: 0, v: 0, goal: 0, wait: 0 }));
  state.explode.target = 0;
  load(state.config);
  state.playing = true;
  advance(Math.max(0, t));
  state.playing = false;
  draw();
  syncButtons();
}
const tourLength = () => state.durations.reduce((a, b) => a + b, 0);
function explodeAt(t) {
  Object.values(state.explode.shares).forEach((share) => Object.assign(share, { x: 0, v: 0, goal: 0, wait: 0 }));
  state.explode.target = 1;
  for (let left = t; left > 1e-9; left -= 1 / 120) stepExplode(Math.min(1 / 120, left));
  draw();
}
window.seek = seekTime;
window.tourLength = tourLength;

function syncControls() {
  const c = state.config;
  $("#dm-program").value = c.program;
  $("#dm-symbols").checked = c.symbols;
  $("#dm-sweep").value = c.sweep;
  $("#dm-opt").value = c.opt;
  $("#dm-opt").disabled = c.program === "trap";
  const source = D.SOURCES[M.keyOf(c)];
  $("[data-dm-source]").innerHTML = escapeHtml(source).replace(/(-O\d)/g, '<span class="dm-nobr">$1</span>');
  $("[data-dm-bytes]").textContent = state.program.bytes;
}
function syncButtons() {
  const run = $("[data-dm-run]");
  run.textContent = state.playing ? "Pause" : state.done ? "Run again" : state.shown >= 0 ? "Resume" : "Run";
  run.setAttribute("aria-pressed", String(state.playing));
  $("[data-dm-explode]").setAttribute("aria-pressed", String(Boolean(state.explode.target)));
  $("[data-dm-explode]").textContent = state.explode.target ? "Assemble" : "Explode";
}
function writeUrl() {
  const params = new URLSearchParams(M.encode(state.config));
  if (document.documentElement.classList.contains("iso-nolabels")) params.set("labels", "0");
  if (typeof palette === "string" && palette !== "mint") params.set("pal", palette);
  const query = params.toString();
  const keep = /[?&]still\b/.test(location.search) ? (query ? "&still" : "still") : "";
  history.replaceState(null, "", location.pathname + (query || keep ? "?" + query + keep : "") + location.hash);
}
let flashTimer = 0;
function flash(text) {
  const node = $("[data-dm-flash]");
  node.textContent = text;
  node.dataset.on = "";
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => delete node.dataset.on, 3200);
}

function render(index) {
  const sim = state.sim;
  const ev = index < 0 ? null : sim.events[index];
  const corner = document.querySelector("[data-readout]");
  if (corner) corner.textContent = ev ? `step ${ev.index + 1} of ${sim.events.length} · ${ev.type}` : `ready · ${sim.events.length} steps queued`;
  $("[data-dm-stage-name]").textContent = ev ? `${ev.stage}/9 ${D.CONCEPT[ev.station]} · ${ev.trace}` : "Ready · press Run";
  $("[data-dm-decoded]").textContent = ev && ev.decoded ? `${ev.decoded} · ${state.config.sweep === "linear" ? "linear sweep" : "descent"}` : "0";
  $("[data-dm-blocks]").textContent = ev && ev.live ? `${ev.live} live${ev.dropped ? ` · ${ev.dropped} dropped` : ""}` : "0";
  $("[data-dm-names]").innerHTML = breakable(ev ? ev.signature || ev.name || "none yet" : "none yet");
  const tally = ev ? M.tallyOf(ev.ledger) : { observed: 0, derived: 0, inferred: 0, unknown: 0 };
  $("[data-dm-unknowns]").textContent = String(tally.unknown);
  $("[data-dm-evidence]").textContent = `${tally.observed} observed · ${tally.derived} derived · ${tally.inferred} inferred`;
  $("[data-dm-steps]").textContent = ev ? `${ev.index + 1} / ${sim.events.length}` : `0 / ${sim.events.length}`;
  const shown = sim.events.slice(0, index + 1);
  const list = $("[data-dm-trace]");
  list.innerHTML = shown.map((item) => `<li data-type="${item.type}"><span class="dm-n">${String(item.index + 1).padStart(2, "0")}</span><span class="dm-t">${item.type}</span><span class="dm-d">${escapeHtml(item.trace)}</span></li>`).join("");
  list.scrollTop = list.scrollHeight;
  const entries = ev ? ev.ledger : [];
  $("[data-dm-ledger]").innerHTML = entries.length ? entries.map((entry) => `<li data-confidence="${entry.confidence}"><span class="dm-c">${entry.confidence}</span><span>${escapeHtml(entry.claim)}</span></li>`).join("") : "<li><span>empty</span></li>";
  const decodeEvent = shown.find((item) => item.type === "decode");
  $("[data-dm-listing]").innerHTML = decodeEvent
    ? decodeEvent.insns.map((insn) => `<li${decodeEvent.extra.includes(insn.a) ? " data-extra" : ""}><span>${insn.a.toString(16).padStart(4, "0")}</span><span>${insn.hex}</span><span>${escapeHtml(insn.text)}</span></li>`).join("")
    : "<li><span>not decoded yet</span></li>";
  const status = $("[data-dm-status]");
  const out = $("[data-dm-output]");
  const final = ev && ev.type === "exit";
  const emitted = shown.find((item) => item.type === "emit");
  status.textContent = final ? sim.outcome.status : ev ? "running" : "waiting";
  status.dataset.status = final ? sim.outcome.status : ev ? "running" : "idle";
  out.textContent = emitted ? emitted.lines.join("\n") : final ? sim.outcome.text : "No pseudocode yet.";
}

$("[data-dm-run]").addEventListener("click", () => (state.playing ? pause() : play()));
$("[data-dm-step]").addEventListener("click", step);
$("[data-dm-break]").addEventListener("click", breakOne);
$("[data-dm-repair]").addEventListener("click", repair);
$("[data-dm-explode]").addEventListener("click", toggleExplode);
$("[data-dm-reset]").addEventListener("click", () => {
  state.explode.target = 0;
  inspect(null);
  load(M.DEFAULTS);
  kick();
});
const configFromForm = () => ({ program: $("#dm-program").value, symbols: $("#dm-symbols").checked, sweep: $("#dm-sweep").value, opt: $("#dm-opt").value });
["#dm-program", "#dm-symbols", "#dm-sweep", "#dm-opt"].forEach((selector) => $(selector).addEventListener("change", () => load(configFromForm(), { autoplay: state.playing || state.shown >= 0 })));
$$("[data-dm-speed]").forEach((button) =>
  button.addEventListener("click", () => {
    state.speed = Number(button.dataset.dmSpeed);
    $$("[data-dm-speed]").forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
  }),
);
$$("[data-dm-scenario]").forEach((button) =>
  button.addEventListener("click", () => {
    load({ ...M.DEFAULTS, ...JSON.parse(button.dataset.dmScenario) }, { autoplay: true });
    $$("[data-dm-scenario]").forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
    showTab("run");
  }),
);
$("[data-dm-share]").addEventListener("click", async () => {
  const url = location.href.replace(/([?&])still\b&?/, "$1").replace(/[?&]$/, "");
  try {
    await navigator.clipboard.writeText(url);
    flash("Link copied. It opens with these switches set.");
  } catch (error) {
    flash(url);
  }
});

function showTab(name) {
  $$("[data-dm-tab]").forEach((tab) => {
    const on = tab.dataset.dmTab === name;
    tab.setAttribute("aria-selected", String(on));
    tab.tabIndex = on ? 0 : -1;
  });
  $$("[data-dm-panel]").forEach((panel) => (panel.hidden = panel.dataset.dmPanel !== name));
}
$$("[data-dm-tab]").forEach((tab, index, tabs) => {
  tab.addEventListener("click", () => showTab(tab.dataset.dmTab));
  tab.addEventListener("keydown", (event) => {
    const move = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!move) return;
    event.preventDefault();
    const next = tabs[(index + move + tabs.length) % tabs.length];
    showTab(next.dataset.dmTab);
    next.focus();
  });
});

function inspect(asm) {
  state.selected = asm;
  const panel = $("[data-dm-inspect]");
  const info = asm ? D.INFO[asm] : null;
  $$("[data-dm-part]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.dmPart === asm)));
  if (!info) {
    panel.innerHTML = `<p class="dm-muted">Select a part of the machine, or pick one from the list, to see which stage of a decompiler it does.</p>`;
    kick();
    return;
  }
  panel.innerHTML = `<p class="dm-label">${D.CONCEPT[asm]}</p><h3>${escapeHtml(info.name)}</h3><p class="dm-kicker">${breakable(info.is)}</p><dl><dt>What it does</dt><dd>${breakable(info.does)}</dd><dt>Why you need it</dt><dd>${breakable(info.why)}</dd><dt>Without it</dt><dd>${breakable(info.without)}</dd><dt>In code</dt><dd><code>${breakable(info.code)}</code></dd></dl><a class="dm-lesson" href="${info.lesson.href}">Lesson: ${escapeHtml(info.lesson.title)} →</a>`;
  kick();
}
$$("[data-dm-part]").forEach((button) => button.addEventListener("click", () => inspect(state.selected === button.dataset.dmPart ? null : button.dataset.dmPart)));
layer.addEventListener("click", (event) => {
  const node = event.target.closest("g[data-i]");
  if (!node) return;
  const asm = meta[node.dataset.i].asm;
  if (!D.INFO[asm]) return;
  inspect(state.selected === asm ? null : asm);
  showTab("inspect");
});
stage.addEventListener("keydown", (event) => {
  if (event.target !== stage) return;
  const key = event.key.toLowerCase();
  if (key === " " || key === "enter") state.playing ? pause() : play();
  else if (key === "arrowright") step();
  else if (key === "e") toggleExplode();
  else if (key === "b") breakOne();
  else if (key === "r") repair();
  else return;
  event.preventDefault();
});

const PALETTES = Ink.PALETTES;
const figure = document.querySelector(".dm-figure");
const blend = Ink.blend;
var palette = startPalette && Object.hasOwn(PALETTES, startPalette) ? startPalette : "mint";
function paint() {
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  const [l, m, d] = PALETTES[palette].map((hex) => (dark ? blend(hex, "#1f1c18", 0.38) : hex));
  figure.style.setProperty("--body-l", l);
  figure.style.setProperty("--body-m", m);
  figure.style.setProperty("--body-d", d);
  $$("[data-dm-pal]").forEach((button) => {
    button.style.background = PALETTES[button.dataset.dmPal][0];
    button.setAttribute("aria-pressed", String(button.dataset.dmPal === palette));
  });
}
$$("[data-dm-pal]").forEach((button) => button.addEventListener("click", () => ((palette = button.dataset.dmPal), paint(), writeUrl())));
new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
paint();
const wobble = svg.querySelector("[data-wobble]");
function setWobble(value) {
  wobble.setAttribute("scale", String(value));
  value > 0 ? layer.setAttribute("filter", "url(#dm-hand)") : layer.removeAttribute("filter");
}
$("#dm-wobble").addEventListener("input", (event) => setWobble(Number(event.target.value)));
function setLabels(on) {
  document.documentElement.classList.toggle("iso-nolabels", !on);
  $("#dm-labels").checked = on;
  writeUrl();
}
$("#dm-labels").addEventListener("change", (event) => setLabels(event.target.checked));
if (startParams.get("labels") === "0") document.documentElement.classList.add("iso-nolabels"), ($("#dm-labels").checked = false);

window.__machine = {
  state,
  load,
  play,
  pause,
  step,
  breakOne,
  repair,
  toggleExplode,
  inspect,
  seekTime,
  explodeAt,
  tourLength,
  setMode,
  seek: (n) => {
    state.stopAt = n;
    state.playing = true;
    advance(1e6);
    state.playing = false;
    draw();
  },
  finish: () => {
    state.playing = true;
    advance(1e6);
    draw();
  },
};
load(state.config);
function fitView() {
  const root = document.documentElement;
  const hidden = root.classList.contains("iso-nolabels");
  root.classList.remove("iso-nolabels");
  const shares = Object.values(state.explode.shares);
  const saved = shares.map((share) => share.x);
  const boxes = [0, 1].map((x) => {
    shares.forEach((share) => (share.x = x));
    draw();
    return [layer.getBBox(), pillLayer.getBBox()];
  });
  shares.forEach((share, i) => (share.x = saved[i]));
  draw();
  if (hidden) root.classList.add("iso-nolabels");
  const all = boxes.flat().filter((box) => box.width && box.height);
  const x0 = Math.min(...all.map((box) => box.x)) - 6;
  const y0 = Math.min(...all.map((box) => box.y)) - 6;
  const x1 = Math.max(...all.map((box) => box.x + box.width)) + 6;
  const y1 = Math.max(...boxes.map(([box]) => box.y + box.height)) + 4;
  svg.setAttribute("viewBox", `${x0.toFixed(1)} ${y0.toFixed(1)} ${(x1 - x0).toFixed(1)} ${(y1 - y0).toFixed(1)}`);
}
fitView();
let started = false;
if (document.documentElement.hasAttribute("data-poster")) {
  started = true;
  window.__machine.seek(5);
  state.pose.hot = ["types"];
  draw();
}
new IntersectionObserver((entries) => {
  const entry = entries[entries.length - 1];
  if (entry.isIntersecting && !started && !still.matches && !/[?&]still\b/.test(location.search)) {
    started = true;
    setTimeout(() => mode === "auto" && state.shown < 0 && !state.playing && play(), 900);
  }
}, { threshold: 0.35 }).observe(stage);
