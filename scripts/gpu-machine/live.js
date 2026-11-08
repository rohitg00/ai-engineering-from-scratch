const svg = document.querySelector("[data-gm-svg]");
const stage = document.querySelector("[data-gm-stage]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const n = (value) => Math.round(value).toLocaleString("en-US");
const escapeHtml = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pick = (value, gpu) => (value && typeof value === "object" && !Array.isArray(value) ? value[gpu] : value);
const pillLayer = svg.querySelector("[data-pills]");

const RIGS = {};
for (const [name, rig] of Object.entries(D.rigs)) {
  const layer = svg.querySelector(`[data-rig="${name}"]`);
  const sorted = layer.querySelector("[data-layer]");
  const nodes = {};
  rig.items.forEach((item) => (nodes[item.id] = sorted.querySelector(`:scope > g[data-i="${item.id}"]`)));
  const cells = [];
  const total = rig.CHIPS * 48;
  for (let g = 0; g < total; g++) cells.push(layer.querySelector(`[data-cell="${g % rig.CHIPS}:${Math.floor(g / rig.CHIPS)}"]`));
  RIGS[name] = { ...rig, layer, sorted, nodes, cells, live: (id) => layer.querySelector(`[data-live="${id}"]`), sms: Array.from(layer.querySelectorAll(".sm[data-sm]")), cores: Array.from(layer.querySelectorAll(".core")), l2: Array.from(layer.querySelectorAll(".l2")), mcs: Array.from(layer.querySelectorAll(".mc, .io")), packets: Array.from(layer.querySelectorAll("[data-pk]")), pulses: Array.from(layer.querySelectorAll("[data-lp]")), queue: Array.from(layer.querySelectorAll("[data-q]")) };
}

function along(points, t) {
  const lengths = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    lengths.push(l);
    total += l;
  }
  let at = clamp(t, 0, 1) * total;
  for (let i = 0; i < lengths.length; i++) {
    if (at <= lengths[i] || i === lengths.length - 1) {
      const f = lengths[i] ? Math.min(1, at / lengths[i]) : 0;
      const a = points[i];
      const b = points[i + 1];
      return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
    }
    at -= lengths[i];
  }
  return points[points.length - 1].slice();
}
const lengthOf = (points) => points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - points[i][0], p[1] - points[i][1], p[2] - points[i][2]), 0);

function freshPose(rig) {
  return { req: rig.WAYPOINTS.port.slice(), reqOn: 0, queue: 0, poolUsed: 0, mine: 0, fill: 0, pre: 0, read: 0, sm: 0, l2: 0, mc: 0, core: "", flowOn: 0, flowDir: 1, flow: 0, launchOn: 0, lphase: 0, gbs: 0, stepT: -1, lamps: {}, hot: [] };
}

function beatsFor(sim) {
  const rig = RIGS[sim.config.gpu];
  const W = rig.WAYPOINTS;
  const beats = [];
  const b = (d, to = {}, extra = {}) => beats.push({ d, to, ...extra });
  const go = (points, hot) => beats.push({ d: "path", to: {}, path: points, hot });
  const dec = sim.decode;
  const share = dec.share === null ? 0.62 : dec.share;
  const readDur = clamp(1.25 * share, 0.35, 1.2);
  const compDur = clamp(1.25 * (1 - share), 0.12, 0.7);
  const send = rig.LAUNCH.slice(1);
  const back = send.slice().reverse().concat([W.detok]);
  const gbs = dec.effectiveGBs || 0;
  const decodeCycle = (read, comp, lampOf) => {
    b(read, { read: 1, gbs, stepT: share }, { hot: ["weights"], start: (p) => Object.assign(p, { read: 0, stepT: 0, flowOn: 1, flowDir: 1, l2: 1, mc: 1, launchOn: sim.config.graphs ? 0 : 1 }, lampOf(p)) });
    b(comp, { gbs: 0, stepT: 1 }, { hot: ["sms"], start: (p) => Object.assign(p, { flowOn: 0, l2: 0, mc: 0, sm: 1 }), end: (p) => Object.assign(p, { sm: 0, read: 0, launchOn: 0, stepT: -1 }) });
  };
  sim.events.forEach((ev, index) => {
    const mark = beats.length;
    const lamp = (p) => ((p.lamps[ev.station] = ev.lamp), {});
    switch (ev.type) {
      case "arrive":
        b(0.5, {}, { hot: ["ingress"], start: (p) => Object.assign(p, { reqOn: 1, req: W.port.slice() }, lamp(p)) });
        break;
      case "tokenize":
        go([W.tokenizer], ["tokenizer"]);
        b(0.6, {}, { hot: ["tokenizer"], start: (p) => Object.assign(p, { core: "tok" }, lamp(p)), end: (p) => (p.core = "") });
        break;
      case "match":
        go([W.scheduler], ["scheduler"]);
        b(0.8, {}, { hot: ["scheduler", "pool"], start: (p) => Object.assign(p, { core: "sched", poolUsed: ev.poolUsed, pre: ev.matched > 0 ? 1 : 0 }, lamp(p)), end: (p) => (p.core = "") });
        break;
      case "queue":
        go([W.queue], ["scheduler"]);
        b(1.0, {}, { hot: ["scheduler", "pool"], start: (p) => Object.assign(p, { queue: Math.min(8, ev.waiting), poolUsed: ev.poolUsed }, lamp(p)) });
        break;
      case "admit":
        go([W.scheduler], ["scheduler"]);
        b(0.7, {}, { hot: ["scheduler", "pool"], start: (p) => Object.assign(p, { queue: 0, core: "sched", poolUsed: ev.poolUsed, mine: ev.mine, fill: 0 }, lamp(p)), end: (p) => (p.core = "") });
        break;
      case "send":
        go(send, ["link"]);
        b(0.3, {}, { hot: ["link"], start: lamp });
        break;
      case "reuse":
        b(0.9, {}, { hot: ["pool"], start: (p) => Object.assign(p, { pre: 1 }, lamp(p)) });
        break;
      case "prefill":
        if (ev.chunk === 1) go([W.die], ["sms"]);
        b(1.0, { fill: ev.chunk / ev.chunks }, { hot: ["sms"], start: (p) => Object.assign(p, { sm: 1, flowOn: 1, flowDir: -1, mc: 1 }, lamp(p)), end: (p) => Object.assign(p, { sm: 0, flowOn: 0, mc: 0 }) });
        break;
      case "first":
        b(0.5, {}, { hot: ["sms"], start: (p) => Object.assign(p, { pre: 0, fill: 1 }, lamp(p)) });
        break;
      case "decode":
        decodeCycle(readDur, compDur, lamp);
        break;
      case "decode-rest":
        for (let i = 0; i < 3; i++) decodeCycle(clamp(readDur * 0.4, 0.14, 0.5), clamp(compDur * 0.5, 0.1, 0.3), lamp);
        break;
      case "detok":
        go(back, ["link"]);
        b(0.6, {}, { hot: ["detok"], start: (p) => Object.assign(p, { core: "detok" }, lamp(p)), end: (p) => (p.core = "") });
        break;
      case "exit":
        go([W.port], ["ingress"]);
        b(0.6, {}, { hot: ["ingress"], start: (p) => Object.assign(p, { mine: 0, fill: 0, poolUsed: ev.poolUsed }, lamp(p)), end: (p) => (p.reqOn = 0) });
        break;
    }
    beats[mark].event = index;
  });
  let pos = W.port.slice();
  for (const beat of beats) {
    if (beat.d === "path") {
      beat._points = [pos, ...beat.path];
      beat._dur = Math.min(1.3, 0.3 + lengthOf(beat._points) / 170);
      pos = beat.path[beat.path.length - 1].slice();
    } else beat._dur = beat.d;
  }
  return beats;
}

function timingOf(sim, beats) {
  const per = sim.events.map(() => 0);
  let current = -1;
  for (const beat of beats) {
    if (beat.event !== undefined) current = beat.event;
    per[current] += beat._dur;
  }
  const p = sim.point;
  const first = sim.events.findIndex((ev) => ev.type === "first");
  const preAnim = per.slice(0, first + 1).reduce((a, b) => a + b, 0);
  return sim.events.map((ev, i) => {
    if (!p) return null;
    if (i <= first) return { real: p.ttft, anim: preAnim };
    if (ev.type === "decode") return { real: p.tpot, anim: per[i] };
    if (ev.type === "decode-rest") return { real: p.tpot * (sim.admission.output - 1 - M.SHOWN_STEPS), anim: per[i] };
    return null;
  });
}
function badgeOf(timing) {
  if (!timing) return "not timed";
  const ratio = (timing.anim * 1000) / timing.real;
  return ratio >= 1 ? `x1/${Math.round(ratio).toLocaleString("en-US")}` : `x${Math.round(1 / ratio).toLocaleString("en-US")}`;
}

const state = { config: M.decode(location.search), sim: null, beats: [], bi: 0, bt: 0, pose: null, playing: false, stopAt: -1, shown: -1, done: false, speed: 1, selected: null, rigName: "", explode: { target: 0, shares: {} } };

function rig() {
  return RIGS[state.config.gpu];
}

function load(config, { autoplay = false } = {}) {
  state.config = M.configOf(config);
  state.sim = M.simulate(state.config);
  if (state.rigName !== state.config.gpu) {
    state.rigName = state.config.gpu;
    for (const [name, r] of Object.entries(RIGS)) r.layer.style.display = name === state.rigName ? "" : "none";
    state.explode.shares = {};
    rig().ASSEMBLIES.forEach((asm) => (state.explode.shares[asm] = { x: state.explode.target, v: 0, goal: state.explode.target }));
    lastOrder = "";
    lastPills = "";
  }
  state.beats = beatsFor(state.sim);
  state.timing = timingOf(state.sim, state.beats);
  let currentEvent = 0;
  state.beatStep = state.beats.map((beat) => (beat.event !== undefined && (currentEvent = beat.event), M.stepOf(state.sim.events[currentEvent].type)));
  Object.assign(state, { pose: freshPose(rig()), bi: 0, bt: 0, shown: -1, done: false, stopAt: -1, time: 0 });
  lastCells = "";
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
  state.pose.hot = beat.hot || [];
}
function apply(beat, t) {
  for (const [key, target] of Object.entries(beat.to)) state.pose[key] = lerp(beat._from[key], target, ease(t));
  if (beat._points) state.pose.req = along(beat._points, ease(t));
}

function advance(dt) {
  let left = dt;
  while (left > 0 && state.bi < state.beats.length) {
    const beat = state.beats[state.bi];
    if (state.bt === 0) {
      if (state.stopAt >= 0 && beat.event !== undefined && beat.event > state.stopAt) {
        state.playing = false;
        state.stopAt = -1;
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
      state.time += remaining;
      state.bi += 1;
      state.bt = 0;
    } else {
      state.bt += left;
      state.time += left;
      apply(beat, state.bt / beat._dur);
      left = 0;
    }
  }
  if (state.bi >= state.beats.length && !state.done) {
    state.done = true;
    state.playing = false;
    state.pose.hot = [];
    render(state.sim.events.length - 1);
    const o = state.sim.outcome;
    $("[data-gm-live]").textContent = `Run finished: ${o.status}. ${o.text}`;
    syncButtons();
    if (mode === "auto" && !renderMode) setTimeout(() => mode === "auto" && state.done && play(), 1600);
  }
}

function onEvent(index) {
  state.shown = index;
  render(index);
}

let lastOrder = "";
let lastPills = "";
const narrow = matchMedia("(max-width: 640px)");
const FULL_BOX = svg.getAttribute("viewBox");
const PHONE_BOX = "150 -96 700 764";
const PHONE_PILL = 17;
const offsetOf = (r, asm) => mul(r.EXPLODE[asm] || [0, 0, 0], state.explode.shares[asm] ? state.explode.shares[asm].x : 0);
const explodedAt = (r, label) => K.iso(add(label.at, offsetOf(r, label.asm)), r.P);
function phoneLayout(r) {
  if (r._phone) return r._phone;
  const width = (text) => text.length * PHONE_PILL * 0.62 + PHONE_PILL * 1.6;
  const entries = r.LABELS.map((label) => ({ label, a: K.iso(label.at, r.P), w: width(label.text) }));
  const ys = entries.map((e) => e.a[1]);
  const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
  const out = [];
  for (const [list, rows] of [[entries.filter((e) => e.a[1] < mid), [-72, -36]], [entries.filter((e) => e.a[1] >= mid), [466, 502]]]) {
    list.sort((p, q) => p.a[0] - q.a[0]);
    const half = Math.ceil(list.length / 2);
    [list.slice(0, half), list.slice(half)].forEach((row, ri) => {
      const total = row.reduce((sum, e) => sum + e.w + 8, -8);
      let x = 500 - total / 2;
      row.forEach((e) => {
        const cx = x + e.w / 2;
        x += e.w + 8;
        out.push({ ...e.label, dx: Math.round(cx - e.a[0]), dy: Math.round(rows[ri] - e.a[1]) });
      });
    });
  }
  return (r._phone = out);
}
narrow.addEventListener("change", () => ((lastPills = ""), draw()));
let lastCells = "";
const hash = (g) => ((g * 2654435761) >>> 0) % 1000 / 1000;

function cellKey(pose) {
  return [pose.poolUsed, pose.mine, Math.round(pose.fill * 40), pose.pre, Math.round(pose.read * 24), state.sim.config.dtype, state.sim.pool].join("|");
}

function paintCells(r, pose) {
  const sim = state.sim;
  const mem = sim.memory;
  const adm = sim.admission;
  const chips = r.CHIPS;
  const K = mem.kvCells;
  const tpc = sim.pool / K;
  const sharedFits = adm.prefixFits === true;
  const prefixCells = sharedFits ? Math.min(K, Math.ceil(adm.prefix / tpc)) : 0;
  const myPrefix = sharedFits ? Math.min(prefixCells, Math.ceil(sim.config.shared / tpc)) : 0;
  const mineTokens = pose.mine ? pose.mine * pose.fill : 0;
  const mineCells = pose.mine && pose.fill > 0 ? Math.max(1, Math.round(mineTokens / tpc)) : 0;
  const othersTokens = Math.max(0, pose.poolUsed - (pose.mine || 0) - (sharedFits ? adm.prefix : 0));
  const otherCells = Math.round(othersTokens / tpc);
  const moe = !D.dense[sim.config.gpu];
  const readFrac = moe ? (sim.decode.readGB !== null ? sim.decode.readGB / sim.decode.weightsGB : 0.5) : 1;
  const perChip = mem.weightCells / chips;
  state.mix = { K, prefixCells, myPrefix: pose.pre ? myPrefix : 0, otherCells, mineCells };
  r.cells.forEach((cell, g) => {
    let c = "";
    let read = false;
    if (g < mem.weightCells) {
      c = "w";
      const rank = Math.floor(g / chips);
      if (pose.read > 0 && rank < pose.read * perChip + 0.5 && (!moe || hash(g) < readFrac)) read = true;
    } else if (g < mem.weightCells + K) {
      const i = g - mem.weightCells;
      if (i < prefixCells) c = pose.pre && i < myPrefix ? "pre" : "kv";
      else if (i < prefixCells + otherCells) c = "kv";
      else if (i < prefixCells + otherCells + mineCells) c = "me";
      else c = "free";
    }
    if (cell.dataset.c !== c) c ? (cell.dataset.c = c) : delete cell.dataset.c;
    if (read !== cell.hasAttribute("data-r")) read ? cell.setAttribute("data-r", "") : cell.removeAttribute("data-r");
  });
}

function draw() {
  const r = rig();
  const pose = state.pose;
  const T = {};
  for (const item of r.items) T[item.id] = offsetOf(r, item.asm);
  T.req = add(T.req, pose.req);
  for (const item of r.items) {
    const t = T[item.id];
    const node = r.nodes[item.id];
    const text = t[0] || t[1] || t[2] ? K.translateAlong(r.P, t) : "";
    if (node._t !== text) {
      text ? node.setAttribute("transform", text) : node.removeAttribute("transform");
      node._t = text;
    }
  }
  const keyed = r.items.map((item) => [item.id, item.key + dot(T[item.id], r.V)]).sort((a, b) => a[1] - b[1]);
  const order = keyed.map((entry) => entry[0]).join(",");
  if (order !== lastOrder) {
    const fragment = document.createDocumentFragment();
    keyed.forEach(([id]) => fragment.appendChild(r.nodes[id]));
    r.sorted.appendChild(fragment);
    lastOrder = order;
  }

  r.live("req").style.display = pose.reqOn ? "" : "none";
  r.queue.forEach((node, i) => (node.style.display = i < pose.queue ? "" : "none"));
  const key = cellKey(pose);
  if (key !== lastCells) {
    paintCells(r, pose);
    lastCells = key;
  }
  r.sms.forEach((node) => (pose.sm ? node.setAttribute("data-on", "") : node.removeAttribute("data-on")));
  const coreOn = (node) => {
    const id = node.dataset.core;
    if (!pose.core) return false;
    if (state.config.gpu === "l4") return id === pose.core;
    return (pose.core === "tok" && (id === "a0" || id === "a1")) || (pose.core === "sched" && (id === "b0" || id === "b1")) || (pose.core === "detok" && (id === "a8" || id === "a9"));
  };
  r.cores.forEach((node) => (coreOn(node) ? node.setAttribute("data-on", "") : node.removeAttribute("data-on")));
  r.l2.forEach((node) => (pose.l2 && !node.hasAttribute("data-slc") ? node.setAttribute("data-on", "") : node.removeAttribute("data-on")));
  r.mcs.forEach((node) => (pose.mc ? node.setAttribute("data-on", "") : node.removeAttribute("data-on")));

  const flows = r.FLOWS;
  const per = Math.floor(r.packets.length / flows.length);
  r.packets.forEach((node, i) => {
    if (!pose.flowOn) {
      if (node.style.display !== "none") node.style.display = "none";
      return;
    }
    const path = flows[i % flows.length];
    let t = (state.time * 1.26 + Math.floor(i / flows.length) / per) % 1;
    if (pose.flowDir < 0) t = 1 - t;
    const at = add(along(path, t), T.flow);
    node.style.display = "";
    node.setAttribute("transform", K.translateAlong(r.P, at));
  });
  r.pulses.forEach((node, i) => {
    if (!pose.launchOn) {
      if (node.style.display !== "none") node.style.display = "none";
      return;
    }
    const t = (state.time * 2.2 + i / r.pulses.length) % 1;
    node.style.display = "";
    node.setAttribute("transform", K.translateAlong(r.P, along(r.LAUNCH, t)));
  });

  for (const station of D.STATIONS) {
    const lamp = r.live(`lamp-${station}`);
    if (!lamp) continue;
    const wanted = pose.lamps[station] || "";
    if (lamp.dataset.state !== wanted) lamp.dataset.state = wanted;
  }

  const hotStations = new Set(pose.hot);
  if (state.selected) hotStations.add(state.selected);
  const hotItems = new Set();
  for (const station of hotStations) for (const id of r.HOT[station] || []) hotItems.add(id);
  if (hotStations.has("pool") || hotStations.has("weights")) r.items.forEach((item) => item.asm === "mem" && hotItems.add(item.id));
  if (state.selected === "package") ["substrate", "balls", "die", "sdie", "gdie"].forEach((id) => hotItems.add(id));
  if (state.selected === "cooler") hotItems.add("cooler");
  for (const item of r.items) {
    const node = r.nodes[item.id];
    const on = hotItems.has(item.id);
    if (on !== node.hasAttribute("data-hot")) on ? node.setAttribute("data-hot", "") : node.removeAttribute("data-hot");
  }
  const phone = narrow.matches;
  const layout = phone ? phoneLayout(r) : r.LABELS;
  const pills = layout.map((label) => {
    const home = K.iso(label.at, r.P);
    const moved = explodedAt(r, label);
    return Ink.pillSvg(moved, label.dx + home[0] - moved[0], label.dy + home[1] - moved[1], label.text, label.stations.some((s) => hotStations.has(s)) || state.selected === label.id, phone ? PHONE_PILL : undefined);
  }).join("");
  const box = phone ? PHONE_BOX : FULL_BOX;
  if (svg.getAttribute("viewBox") !== box) {
    svg.setAttribute("viewBox", box);
    lastPills = "";
  }
  if (pills !== lastPills) {
    pillLayer.innerHTML = pills;
    lastPills = pills;
  }
  drawGauge(pose);
  drawCut(r, pose);
  drawSound(r);
  drawDisplay(r, pose);
}

const cut = svg.querySelector("[data-cut]");
const cutWeights = Array.from(cut.querySelectorAll("[data-cw]"));
const cutKv = Array.from(cut.querySelectorAll("[data-ck]"));
const cutSm = cut.querySelector("[data-csm]");
const cutTok = cut.querySelector("[data-ctok]");
const cutLead = svg.querySelector("[data-clead]");
let lastCut = "";
function drawCut(r, pose) {
  const phone = narrow.matches;
  const origin = phone ? [356, 536] : [762, 300];
  const label = r.LABELS.find((l) => l.id === "pool");
  const anchor = explodedAt(r, label);
  const mix = state.mix || { K: 1, prefixCells: 0, myPrefix: 0, otherCells: 0, mineCells: 0 };
  const s = state.sim.serve;
  const ev = state.shown >= 0 ? state.sim.events[state.shown] : null;
  const key = [phone, Math.round(anchor[0]), Math.round(anchor[1]), Math.round(pose.read * 13), pose.sm, mix.prefixCells, mix.myPrefix, mix.otherCells, mix.mineCells, ev ? ev.index : -1].join("|");
  if (key === lastCut) return;
  lastCut = key;
  cut.setAttribute("transform", `translate(${origin[0]} ${origin[1]})`);
  cutLead.setAttribute("d", `M${origin[0] + 116} ${origin[1]}L${anchor[0].toFixed(1)} ${anchor[1].toFixed(1)}`);
  cutWeights.forEach((node, i) => (i < Math.round(pose.read * cutWeights.length) ? node.setAttribute("data-r", "") : node.removeAttribute("data-r")));
  const scale = cutKv.length / mix.K;
  const pre = Math.round(mix.prefixCells * scale);
  const mine = Math.round(mix.myPrefix * scale);
  const other = Math.round(mix.otherCells * scale);
  const me = mix.mineCells ? Math.max(1, Math.round(mix.mineCells * scale)) : 0;
  cutKv.forEach((node, i) => {
    const c = i < pre ? (i < mine ? "pre" : "kv") : i < pre + other ? "kv" : i < pre + other + me ? "me" : "free";
    if (node.dataset.c !== c) node.dataset.c = c;
  });
  pose.sm ? cutSm.setAttribute("data-on", "") : cutSm.removeAttribute("data-on");
  let text = `KV pool: ${n(ev ? ev.poolUsed : 0)} of ${n(s.kvPagesTotal)} slots in use`;
  if (ev && (ev.type === "decode" || ev.type === "decode-rest") && pose.sm) text = `result: +${n(s.tokensPerStep)} token${s.tokensPerStep === 1 ? "" : "s"}, +${n(s.tokensPerStep)} KV slot${s.tokensPerStep === 1 ? "" : "s"}`;
  else if (ev && ev.type === "prefill") text = `result: ${n(ev.size)} KV slots written`;
  else if (ev && (ev.type === "decode" || ev.type === "decode-rest")) text = s.weightReadShare === null ? "cause: the weights of the picked experts stream in" : `cause: ${n(s.weightReadShare * 100)}% of the step is this read`;
  cutTok.textContent = text;
}

const soundNode = svg.querySelector("[data-sound]");
let lastSound = "";
function drawSound(r) {
  const ev = state.shown >= 0 && !state.done && state.bi < state.beats.length ? state.sim.events[state.shown] : null;
  let word = "";
  let at = null;
  if (ev) {
    const step = M.STEPS[M.stepOf(ev.type)];
    word = ev.type === "queue" ? "wait..." : ev.type === "decode-rest" ? "whoosh whoosh" : step.sound;
    const station = { reuse: "pool", first: "sms" }[ev.type] || ev.station;
    const label = r.LABELS.find((l) => l.stations.includes(station)) || r.LABELS.find((l) => l.id === station);
    if (label) at = explodedAt(r, label);
  }
  const key = word && at ? `${word}|${Math.round(at[0])}|${Math.round(at[1])}` : "";
  if (key === lastSound) return;
  lastSound = key;
  soundNode.textContent = word;
  if (at) soundNode.setAttribute("transform", `translate(${(at[0] + 8).toFixed(1)} ${(at[1] - 14).toFixed(1)}) rotate(-8)`);
}

let lastDisplay = "";
function drawDisplay(r, pose) {
  const s = state.sim.serve;
  const ev = state.shown >= 0 ? state.sim.events[state.shown] : null;
  const used = ev ? ev.poolUsed : 0;
  const lines = [s.tokS === null ? "tok/s  --" : `tok/s  ${s.tokS.toLocaleString("en-US")}`, `KV  ${Math.round((used / s.kvPagesTotal) * 100)}%  ${n(s.running)} run ${n(s.waiting)} wait`, `read  ${n(pose.gbs)}/${s.peakGBs} GB/s`];
  const key = lines.join("|") + r.name;
  if (key === lastDisplay) return;
  lastDisplay = key;
  lines.forEach((text, i) => {
    const node = r.live(`lcd${i}`);
    if (node) node.textContent = text;
  });
}

let lastGauge = "";
function drawGauge(pose) {
  const peak = state.sim.decode.bandwidth;
  const value = Math.round(pose.gbs);
  const step = pose.stepT;
  const key = `${value}|${peak}|${Math.round(step * 100)}|${narrow.matches}`;
  if (key === lastGauge) return;
  lastGauge = key;
  const f = clamp(value / peak, 0, 1);
  const angle = Math.PI * (1 - f);
  $("[data-gauge-needle]").setAttribute("x2", (70 + Math.cos(angle) * 44).toFixed(1));
  $("[data-gauge-needle]").setAttribute("y2", (92 - Math.sin(angle) * 44).toFixed(1));
  const end = [70 + Math.cos(angle) * 50, 92 - Math.sin(angle) * 50];
  $("[data-gauge-fill]").setAttribute("d", f > 0.001 ? `M20 92A50 50 0 0 1 ${end[0].toFixed(1)} ${end[1].toFixed(1)}` : "");
  $("[data-gauge-value]").textContent = value ? `${n(value)} GB/s` : state.sim.decode.effectiveGBs === null && state.sim.decode.tpot ? "not computed" : "idle";
  $("[data-gauge]").setAttribute("transform", narrow.matches ? "translate(196 532)" : "translate(6 4)");
  const cursor = $("[data-step-cursor]");
  cursor.style.left = step >= 0 ? `${(clamp(step, 0, 1) * 100).toFixed(1)}%` : "-10px";
  cursor.style.opacity = step >= 0 ? "1" : "0";
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
  const i = breakIndex % M.BREAKS.length;
  breakIndex += 1;
  load({ ...M.DEFAULTS, ...M.BREAKS[i] }, { autoplay: true });
  flash(C.BREAK_NOTES[i]);
}
function repair() {
  load(M.DEFAULTS, { autoplay: true });
  flash("Repaired: L4, BF16, 8 users, cool card, graphs and radix cache on.");
}
function toggleExplode() {
  state.explode.target = state.explode.target ? 0 : 1;
  if (state.explode.target) state.playing = false;
  syncButtons();
  kick();
}

const FRACTION_TEXT = { "0.85": "0.85 (kit default)", "0.74": "0.74 (smaller)", "0.7": "0.70 (kit default)", "0.82": "0.82 (larger)" };
function syncControls() {
  const c = state.config;
  $("#gm-gpu").value = c.gpu;
  $("#gm-dtype").value = c.dtype;
  const frac = $("#gm-frac");
  const wanted = M.FRACTIONS[c.gpu].map((value) => `<option value="${value}">${FRACTION_TEXT[value]}</option>`).join("");
  if (frac.dataset.gpu !== c.gpu) {
    frac.innerHTML = wanted;
    frac.dataset.gpu = c.gpu;
  }
  frac.value = c.frac;
  $("#gm-graphs").checked = c.graphs;
  $("#gm-workload").value = c.workload;
  $("#gm-users").value = String(M.USERS.indexOf(c.users));
  $("[data-gm-users-out]").textContent = String(c.users);
  $("#gm-shared").value = String(c.shared);
  $("#gm-radix").checked = c.radix;
  $("#gm-clock").checked = c.clock === "hot";
  $("#gm-clock").disabled = c.gpu !== "l4";
  $("[data-gm-users-wrap]").hidden = c.workload !== "unique";
  $("[data-gm-shared-wrap]").hidden = c.workload !== "shared";
  renderStatic();
}
function syncButtons() {
  if (state.sim) syncSteps();
  const run = $("[data-gm-run]");
  run.textContent = state.playing ? "Pause" : state.done ? "Run again" : state.shown >= 0 ? "Resume" : "Run";
  run.setAttribute("aria-pressed", String(state.playing));
  $("[data-gm-explode]").setAttribute("aria-pressed", String(Boolean(state.explode.target)));
  $("[data-gm-explode]").textContent = state.explode.target ? "Assemble" : "Explode";
}
function writeUrl() {
  const params = new URLSearchParams(M.encode(state.config));
  if (document.documentElement.classList.contains("iso-nolabels")) params.set("labels", "0");
  if (palette !== "green") params.set("pal", palette);
  const query = params.toString();
  const keep = /[?&]still\b/.test(location.search) ? (query ? "&still" : "still") : "";
  history.replaceState(null, "", location.pathname + (query || keep ? "?" + query + keep : "") + location.hash);
}
let flashTimer = 0;
function flash(text) {
  const node = $("[data-gm-flash]");
  node.textContent = text;
  node.dataset.on = "";
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => delete node.dataset.on, 3200);
}

const ms = (value) => (value === null || value === undefined ? "not measured" : `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} ms`);
function renderStatic() {
  const sim = state.sim;
  const c = sim.config;
  const dec = sim.decode;
  const mem = sim.memory;
  const point = sim.point;
  $("[data-gm-model]").textContent = `${D.machine[c.gpu].model} · ${c.dtype.toUpperCase()} · ${D.specs[c.gpu].name}`;
  const work = c.workload === "unique" ? `${n(c.users)} user${c.users === 1 ? "" : "s"}, 512 tokens in, 128 out` : `8 users, 4 groups, a ${n(c.shared)}-token shared system prompt, 128-token question, 64 out`;
  $("[data-gm-work]").textContent = work;
  const read = dec.readGB === null ? "the experts that the batch picks" : D.dense[c.gpu] ? `${dec.readGB.toLocaleString("en-US")} GB` : `about ${dec.readGB.toLocaleString("en-US")} GB (an estimate from about 3 billion active parameters)`;
  $("[data-step-text]").innerHTML = dec.floorMs !== null && dec.tpot
    ? `One decode step: <strong>${ms(dec.tpot)}</strong> measured. Reading ${read} at the peak ${dec.bandwidth} GB/s takes at least <strong>${ms(dec.floorMs)}</strong>, so the weight read is <strong>${Math.round(dec.share * 100)}%</strong> of the step.${sim.launch ? ` Without CUDA graphs the step was ${sim.launch.delta >= 0 ? `${ms(sim.launch.delta)} longer` : `${ms(-sim.launch.delta)} shorter`}.` : ""}`
    : dec.tpot
      ? `One decode step: <strong>${ms(dec.tpot)}</strong> measured. ${escapeHtml(dec.basis[0].toUpperCase() + dec.basis.slice(1))}.`
      : `This setting was not measured, so the page shows no step time. ${escapeHtml(dec.basis[0].toUpperCase() + dec.basis.slice(1))}.`;
  $("[data-step-read]").style.width = dec.share !== null ? `${(dec.share * 100).toFixed(1)}%` : "0%";
  $("[data-step-rest]").style.width = dec.share !== null ? `${((1 - dec.share) * 100).toFixed(1)}%` : dec.tpot ? "100%" : "0%";
  $("[data-gauge-peak]").textContent = `of ${dec.bandwidth} GB/s peak`;
  const tpc = sim.pool / mem.kvCells;
  $("[data-gm-memory]").innerHTML = [
    ["w", "Weights", `${mem.weightsGiB} GB`, `${mem.weightCells} cells`],
    ["kv", "KV pool", `${mem.kvGiB} GB, ${n(sim.pool)} tokens`, `${mem.kvCells} cells, about ${n(tpc)} tokens each`],
    ["rest", "Runtime, graphs and free", `${mem.restGiB} GB`, `${mem.restCells} cells`],
  ].map(([k, name, size, cells]) => `<li><i class="gm-key" data-c="${k}"></i><span><strong>${name}</strong> ${escapeHtml(size)}</span><span>${escapeHtml(cells)}</span></li>`).join("");
  $("[data-gm-memory-note]").textContent = `${mem.totalGiB} GB of memory as the driver reports it, drawn as ${mem.cells} cells over ${D.rigs[c.gpu].CHIPS} packages. Every package holds a slice of every region, because the memory controllers interleave addresses across the channels. Sizes are from the startup logs; the GB unit is the one SGLang prints.`;
  const outcome = sim.outcome;
  $("[data-gm-outcome]").textContent = outcome.text;
  const status = $("[data-gm-status]");
  status.textContent = outcome.status;
  status.dataset.status = outcome.status;
  $("[data-gm-measured]").textContent = point ? `Measured run: ${sim.run.set === "l4-hot" ? "the hot L4 sweep" : sim.run.set === "l4" ? "the cooled L4 sweep" : "the GB10 sweep"}, ${sim.run.key}, three seeds, median shown.` : "No run matches this setting. The pool and the arithmetic still come from the logs.";
}

const stepButtons = $$("[data-gm-stepbtn]");
const renderMode = /[?&]render\b/.test(location.search);
if (renderMode) document.documentElement.setAttribute("data-render", "");
let mode = "manual";
try {
  mode = localStorage.getItem("gm-mode") === "auto" ? "auto" : "manual";
} catch (error) {}
if (renderMode) mode = "manual";
function stepLast(index) {
  let last = -1;
  state.sim.events.forEach((ev, i) => M.stepOf(ev.type) === index && (last = i));
  return last;
}
function syncSteps() {
  const beats = state.beats;
  const bi = state.bi;
  const steps = state.beatStep;
  const active = bi < beats.length && (state.playing || state.bt > 0) ? steps[bi] : -1;
  const next = active >= 0 ? active : bi < beats.length ? steps[bi] : -1;
  stepButtons.forEach((button, i) => {
    const last = steps.lastIndexOf(i);
    const status = i === active ? "running" : i === next ? "next" : last < bi ? "done" : "later";
    if (button.dataset.status !== status) button.dataset.status = status;
    button.disabled = mode === "auto" || status === "done" || status === "later" || (status === "running" && state.playing);
    button.setAttribute("aria-current", i === active ? "step" : "false");
  });
  const current = active >= 0 ? active : next >= 0 ? next : M.STEPS.length - 1;
  const step = M.STEPS[current];
  const shown = state.shown;
  $("[data-gm-hint]").textContent = `${current + 1}. ${step.hint}`;
  $("[data-gm-badge]").textContent = state.done ? "done" : shown >= 0 ? badgeOf(state.timing[shown]) : "ready";
  $$("[data-gm-mode]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.gmMode === mode)));
}
function playStep(index) {
  if (state.done) load(state.config);
  state.explode.target = 0;
  state.stopAt = stepLast(index);
  state.playing = true;
  syncButtons();
  kick();
}
stepButtons.forEach((button) => button.addEventListener("click", () => playStep(Number(button.dataset.gmStepbtn))));
$$("[data-gm-mode]").forEach((button) =>
  button.addEventListener("click", () => {
    mode = button.dataset.gmMode;
    try {
      localStorage.setItem("gm-mode", mode);
    } catch (error) {}
    if (mode === "auto") play();
    else pause();
    syncSteps();
  }),
);
$("[data-gm-restart]").addEventListener("click", (event) => {
  event.preventDefault();
  state.explode.target = 0;
  load(state.config);
  mode === "auto" ? play() : syncSteps();
});

function render(index) {
  const sim = state.sim;
  const ev = index < 0 ? null : sim.events[index];
  const c = sim.config;
  const point = sim.point;
  const corner = document.querySelector("[data-readout]");
  if (corner) corner.textContent = ev ? `step ${ev.index + 1} of ${sim.events.length} · ${ev.type}` : `ready · ${sim.events.length} steps`;
  $("[data-gm-stage-name]").textContent = ev ? `${pick(C.NAMES[ev.station], c.gpu) || ev.station} · ${ev.trace}` : "Ready · press Run";
  const sv = sim.serve;
  const used = ev ? ev.poolUsed : 0;
  $("[data-gm-pool]").textContent = `${n(used)} of ${n(sv.kvPagesTotal)} tokens · ${Math.round((used / sv.kvPagesTotal) * 100)}%`;
  $("[data-gm-running]").textContent = `${n(sv.running)} running · ${n(sv.waiting)} held back`;
  $("[data-gm-tps]").textContent = `${n(sv.tokensPerStep)} per step`;
  $("[data-gm-share]").textContent = sv.weightReadShare !== null ? `${Math.round(sv.weightReadShare * 100)}% of the step` : "not computed";
  $("[data-gm-tpot]").textContent = ms(sv.stepMs);
  $("[data-gm-toks]").textContent = sv.tokS !== null ? `${sv.tokS.toLocaleString("en-US")} tok/s` : "not measured";
  $("[data-gm-ttft]").textContent = ms(sv.firstTokenMs);
  $("[data-gm-clock]").textContent = point && point.smMhz ? `${n(point.smMhz)} MHz SM · ${point.maxTemp} C` : c.clock === "hot" ? "360 MHz SM · 87 C (nvidia-smi)" : "not recorded";
  const list = $("[data-gm-trace]");
  list.innerHTML = sim.events.slice(0, index + 1).map((item) => `<li data-type="${item.type}"><span class="gm-n">${String(item.index + 1).padStart(2, "0")}</span><span class="gm-t">${item.type}</span><span class="gm-d">${escapeHtml(item.trace)}${item.clock !== null && item.clock !== undefined ? ` <em>at ${n(item.clock)} ms</em>` : ""}</span></li>`).join("");
  list.scrollTop = list.scrollHeight;
  syncSteps();
}

$("[data-gm-run]").addEventListener("click", () => (state.playing ? pause() : play()));
$("[data-gm-step]").addEventListener("click", step);
$("[data-gm-break]").addEventListener("click", breakOne);
$("[data-gm-repair]").addEventListener("click", repair);
$("[data-gm-explode]").addEventListener("click", toggleExplode);
$("[data-gm-reset]").addEventListener("click", () => {
  state.explode.target = 0;
  inspect(null);
  load(M.DEFAULTS);
  kick();
});
const configFromForm = () => ({ gpu: $("#gm-gpu").value, dtype: $("#gm-dtype").value, frac: $("#gm-gpu").value === $("#gm-frac").dataset.gpu ? $("#gm-frac").value : undefined, graphs: $("#gm-graphs").checked, workload: $("#gm-workload").value, users: M.USERS[Number($("#gm-users").value)], shared: Number($("#gm-shared").value), radix: $("#gm-radix").checked, clock: $("#gm-clock").checked ? "hot" : "cool" });
["#gm-gpu", "#gm-dtype", "#gm-frac", "#gm-graphs", "#gm-workload", "#gm-shared", "#gm-radix", "#gm-clock"].forEach((selector) => $(selector).addEventListener("change", () => load(configFromForm(), { autoplay: state.playing || state.shown >= 0 })));
$("#gm-users").addEventListener("input", () => load(configFromForm(), { autoplay: state.playing || state.shown >= 0 }));
$$("[data-gm-speed]").forEach((button) =>
  button.addEventListener("click", () => {
    state.speed = Number(button.dataset.gmSpeed);
    $$("[data-gm-speed]").forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
  }),
);
$$("[data-gm-scenario]").forEach((button) =>
  button.addEventListener("click", () => {
    load({ ...M.DEFAULTS, ...JSON.parse(button.dataset.gmScenario) }, { autoplay: true });
    $$("[data-gm-scenario]").forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
    showTab("run");
  }),
);
$("[data-gm-copy]").addEventListener("click", async () => {
  const url = location.href.replace(/([?&])still\b&?/, "$1").replace(/[?&]$/, "");
  try {
    await navigator.clipboard.writeText(url);
    flash("Link copied. It opens with these switches set.");
  } catch (error) {
    flash(url);
  }
});

function showTab(name) {
  $$("[data-gm-tab]").forEach((tab) => {
    const on = tab.dataset.gmTab === name;
    tab.setAttribute("aria-selected", String(on));
    tab.tabIndex = on ? 0 : -1;
  });
  $$("[data-gm-panel]").forEach((panel) => (panel.hidden = panel.dataset.gmPanel !== name));
}
$$("[data-gm-tab]").forEach((tab, index, tabs) => {
  tab.addEventListener("click", () => showTab(tab.dataset.gmTab));
  tab.addEventListener("keydown", (event) => {
    const move = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!move) return;
    event.preventDefault();
    const next = tabs[(index + move + tabs.length) % tabs.length];
    showTab(next.dataset.gmTab);
    next.focus();
  });
});

const PART_OF = { port: "ingress", socket: "scheduler", ihs: "scheduler", hostdie: "scheduler", lanes: "link", riser: "link", c2c: "link", die: "sms", gdie: "sms", sdie: "scheduler", substrate: "package", balls: "package", bumps: "package", cooler: "cooler", card: "package", vrm: "package", bracket: "package", plate: null, req: null, queue: "scheduler", flow: "weights", launch: "link" };
function inspect(part) {
  state.selected = part;
  const panel = $("[data-gm-inspect]");
  const gpu = state.config.gpu;
  const info = part ? C.INFO[part] : null;
  $$("[data-gm-part]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.gmPart === part)));
  if (!info) {
    panel.innerHTML = `<p class="gm-muted">Select a part of the machine, or pick one from the list, to see what it does for one request.</p>`;
    kick();
    return;
  }
  panel.innerHTML = `<p class="gm-label">${escapeHtml(pick(C.NAMES[part], gpu))}</p><h3>${escapeHtml(pick(info.name, gpu))}</h3><p class="gm-kicker">${escapeHtml(pick(info.is, gpu))}</p><dl><dt>What it does</dt><dd>${escapeHtml(pick(info.does, gpu))}</dd><dt>Why it matters</dt><dd>${escapeHtml(pick(info.why, gpu))}</dd><dt>Without it</dt><dd>${escapeHtml(pick(info.without, gpu))}</dd></dl><a class="gm-lesson" href="${info.lesson.href}">${escapeHtml(info.lesson.title)} →</a>`;
  kick();
}
$$("[data-gm-part]").forEach((button) => button.addEventListener("click", () => inspect(state.selected === button.dataset.gmPart ? null : button.dataset.gmPart)));
svg.addEventListener("click", (event) => {
  const node = event.target.closest("g[data-i]");
  if (!node) return;
  const id = node.dataset.i;
  let part = PART_OF[id];
  if (part === undefined) part = /^chip/.test(id) ? "pool" : /^lamp-/.test(id) ? id.slice(5) : null;
  if (!part || !C.INFO[part]) return;
  inspect(state.selected === part ? null : part);
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

const PALETTES = D.PALETTES;
const figure = document.querySelector(".gm-figure");
const query = new URLSearchParams(location.search);
let palette = PALETTES[query.get("pal")] ? query.get("pal") : "green";
function paint() {
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  const [l, m, d] = PALETTES[palette].map((hex) => (dark ? Ink.blend(hex, "#1f1c18", 0.38) : hex));
  figure.style.setProperty("--body-l", l);
  figure.style.setProperty("--body-m", m);
  figure.style.setProperty("--body-d", d);
  $$("[data-gm-pal]").forEach((button) => {
    button.style.background = PALETTES[button.dataset.gmPal][1];
    button.setAttribute("aria-pressed", String(button.dataset.gmPal === palette));
  });
}
$$("[data-gm-pal]").forEach((button) => button.addEventListener("click", () => ((palette = button.dataset.gmPal), paint(), writeUrl())));
new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
paint();
const wobble = svg.querySelector("[data-wobble]");
function setWobble(value) {
  wobble.setAttribute("scale", String(value));
  Object.values(RIGS).forEach((r) => {
    const layer = r.layer.querySelector("[data-layer]");
    value > 0 ? layer.setAttribute("filter", "url(#gm-hand)") : layer.removeAttribute("filter");
  });
}
$("#gm-wobble").addEventListener("input", (event) => setWobble(Number(event.target.value)));
function setLabels(on) {
  document.documentElement.classList.toggle("iso-nolabels", !on);
  $("#gm-labels").checked = on;
  writeUrl();
}
$("#gm-labels").addEventListener("change", (event) => setLabels(event.target.checked));
if (query.get("labels") === "0") document.documentElement.classList.add("iso-nolabels"), ($("#gm-labels").checked = false);

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
  seek: (target) => {
    state.stopAt = target;
    state.playing = true;
    advance(1e6);
    state.playing = false;
    draw();
  },
  advance: (seconds) => {
    state.playing = true;
    advance(seconds);
    state.playing = false;
    draw();
  },
  finish: () => {
    state.playing = true;
    advance(1e6);
    draw();
  },
};
window.__steps = M.stepOf;
window.__configs = M.allConfigs;
window.seek = (t) => {
  load(state.config);
  state.playing = true;
  advance(Math.max(0, Number(t) || 0));
  state.playing = false;
  draw();
  syncSteps();
  return { time: state.time, event: state.shown, total: state.beats.reduce((sum, beat) => sum + beat._dur, 0) };
};
load(state.config);
let started = false;
if (document.documentElement.hasAttribute("data-poster")) {
  started = true;
  let t = 0;
  for (const beat of state.beats) {
    if (beat.event !== undefined && state.sim.events[beat.event].type === "decode") break;
    t += beat._dur;
  }
  window.seek(t + 0.5);
}
new IntersectionObserver((entries) => {
  const entry = entries[entries.length - 1];
  if (entry.isIntersecting && !started && !still.matches && !renderMode && mode === "auto" && !/[?&]still\b/.test(location.search)) {
    started = true;
    setTimeout(() => state.shown < 0 && !state.playing && play(), 900);
  }
}, { threshold: 0.35 }).observe(stage);
