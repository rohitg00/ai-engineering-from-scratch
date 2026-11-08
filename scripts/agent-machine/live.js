const svg = document.querySelector("[data-am-svg]");
const layer = svg.querySelector("[data-layer]");
const stage = document.querySelector("[data-am-stage]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const P = D.P;
const V = D.V;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const ZERO = [0, 0, 0];

const nodes = {};
const meta = {};
D.items.forEach((item) => {
  meta[item.id] = item;
  nodes[item.id] = layer.querySelector(`:scope > g[data-i="${item.id}"]`);
});
const live = (name) => svg.querySelector(`[data-live="${name}"]`);

function trackAt(s) {
  const L = D.LOOP;
  const u = ((s % L) + L) % L;
  const i = Math.floor(u);
  const f = u - i;
  const a = D.track[i];
  const b = D.track[(i + 1) % D.track.length];
  return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), 0];
}

const RIG = D.RIG;
const STOP = {
  intake: D.STOPS.intake,
  memory: D.STOPS.memory,
  retrieval: D.STOPS.retrieval,
  model: D.STOPS.model,
  tools: D.STOPS.tools,
  verifier: D.STOPS.verifier,
  exit: D.STOPS.exit,
};
const SLOT = D.slots;
const TRAY_AT = [0, D.TRAY.y + D.TRAY.d / 2, D.TRAY.z];
const HOME_Y = D.TRACK.y;
const GH = D.GRIP_HOME;
const CARRY = 56;
const SLIP_CARRY = 46;
const CARD_HANG = D.RACK.h + 1.2;

function freshPose(config) {
  return {
    s: STOP.exit + 40,
    drawer: 0,
    rY: HOME_Y,
    rZ: GH,
    tY: HOME_Y,
    tZ: GH,
    mZ: 0,
    bolt: 0,
    crank: 0,
    timer: 0,
    flags: [0, 0, 0],
    varm: config.verification ? 0 : 16,
    plunger: 0,
    needle: 0,
    latch: 0,
    lock: config.retrieval ? 0 : 1,
    calc: "     0",
    cards: Array.from({ length: SLOT.length }, () => ({ vis: false, kind: "plain", at: "rack", w: [0, 0, 0], off: [0, 0, 0] })),
    slip: { vis: false, at: "tray", w: [0, 0, 0], off: [0, 0, 0], stamp: false },
    hot: [],
  };
}

const carriageAt = (pose) => trackAt(pose.s);
const gripR = (pose) => [RIG.retrieval.x, pose.rY, pose.rZ];
const gripT = (pose) => [RIG.tools.x, pose.tY, pose.tZ];
function cardAnchor(pose, i) {
  const card = pose.cards[i];
  if (card.at === "rack") return add(carriageAt(pose), [0, SLOT[i].y, SLOT[i].z]);
  if (card.at === "r") return add(gripR(pose), card.off);
  if (card.at === "t") return add(gripT(pose), card.off);
  return card.w;
}
function slipAnchor(pose) {
  const slip = pose.slip;
  if (slip.at === "tray") return add(carriageAt(pose), TRAY_AT);
  if (slip.at === "t") return add(gripT(pose), slip.off);
  return slip.w;
}
function nextS(from, stop) {
  const L = D.LOOP;
  let target = stop;
  while (target < from - 0.01) target += L;
  return target;
}

function getPath(obj, path) {
  return path.split(".").reduce((value, key) => value[key], obj);
}
function setPath(obj, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  keys.reduce((v, key) => v[key], obj)[last] = value;
}
const clone = (value) => (Array.isArray(value) ? value.slice() : value);

function beatsFor(sim) {
  const beats = [];
  let context = [];
  const slotOf = (id) => context.indexOf(id);
  const travel = (stop, hot = ["carriage"]) => beats.push({ d: "travel", stop, hot });
  const b = (d, to, extra = {}) => beats.push({ d, to, ...extra });
  sim.events.forEach((ev, index) => {
    const before = context;
    context = ev.context.slice();
    const added = context.filter((id) => !before.includes(id));
    const mark = beats.length;
    const kindOf = (id) => (id.startsWith("req") ? "request" : id.startsWith("mem") ? "memory" : id.startsWith("inv") ? "doc" : id.startsWith("res") ? "result" : id.startsWith("err") ? "tool-error" : id.startsWith("fb") ? "feedback" : "plain");
    if (before.some((id, i) => context[i] !== id && context.includes(id))) {
      b(0.01, {}, { start: (pose) => relayout(pose, context, kindOf) });
    }
    const chute = (id, from, lip, hot) => {
      const i = slotOf(id);
      b(0.25, {}, { start: (pose) => Object.assign(pose.cards[i], { vis: true, kind: kindOf(id), at: "world", w: from.slice() }), hot });
      b(0.75, (pose) => ({ [`cards.${i}.w`]: [carriageAt(pose)[0], lip[1], lip[2]] }), { hot });
      b(0.45, (pose) => ({ [`cards.${i}.w`]: add(carriageAt(pose), [0, SLOT[i].y, SLOT[i].z]) }), { end: (pose) => (pose.cards[i].at = "rack"), hot });
    };
    switch (ev.type) {
      case "intake": {
        travel(STOP.intake);
        const i = slotOf(added[0]);
        chute(added[0], [RIG.intake.from[0], RIG.intake.from[1] + SLOT[i].y, RIG.intake.from[2]], [0, trackAt(STOP.intake)[1] + SLOT[i].y, RIG.intake.lip[2]], [`card${i}`]);
        break;
      }
      case "memory": {
        travel(STOP.memory);
        const i = slotOf(added[0]);
        chute(added[0], [RIG.memory.from[0], trackAt(STOP.memory)[1] + SLOT[i].y, RIG.memory.from[2]], [0, trackAt(STOP.memory)[1] + SLOT[i].y, RIG.memory.lip[2]], [`card${i}`]);
        break;
      }
      case "retrieve-off": {
        travel(STOP.retrieval);
        b(0.35, { drawer: 1.6 }, { hot: ["lockout", "drawer"] });
        b(0.35, { drawer: 0 }, { hot: ["lockout", "drawer"] });
        b(0.4, {}, { hot: ["lockout"] });
        break;
      }
      case "retrieve": {
        travel(STOP.retrieval);
        const ids = added;
        const slots = ids.map(slotOf);
        const R = RIG.retrieval;
        const hot = ["rhead", "rgrip", "drawer", ...slots.map((i) => `card${i}`)];
        b(0.55, { drawer: R.open }, { hot: ["drawer"] });
        b(0.6, { rY: R.cardsY }, {
          hot,
          start: (pose) =>
            slots.forEach((i, n) =>
              Object.assign(pose.cards[i], { vis: true, kind: "doc", at: "world", w: [R.x, R.cardsY - n * D.RACK.pitch, R.drawers[1][0] + 4] }),
            ),
        });
        b(0.45, { rZ: R.drawers[1][0] + 4 + CARD_HANG }, { hot });
        b(0.5, { rZ: CARRY }, { hot, start: (pose) => slots.forEach((i, n) => Object.assign(pose.cards[i], { at: "r", off: [0, -n * D.RACK.pitch, -CARD_HANG] })) });
        b(0.75, (pose) => ({ rY: carriageAt(pose)[1] + SLOT[slots[0]].y, drawer: 0 }), { hot });
        b(0.5, { rZ: SLOT[slots[0]].z + CARD_HANG }, { hot });
        b(0.45, { rZ: GH }, { hot: ["rhead", "rgrip"], start: (pose) => slots.forEach((i) => (pose.cards[i].at = "rack")) });
        b(0.4, { rY: HOME_Y }, { hot: ["rhead"] });
        break;
      }
      case "model": {
        travel(STOP.model);
        b(0.4, { mZ: -7 }, { hot: ["mhead"] });
        b(0.65, {}, { hot: ["mhead", "lamp"] });
        b(0.45, { mZ: 0 }, { hot: ["mhead", "slip"], start: (pose) => Object.assign(pose.slip, { vis: true, at: "tray", stamp: false }) });
        break;
      }
      case "schema": {
        travel(STOP.tools);
        const T = RIG.tools;
        const hot = ["thead", "tgrip", "slip", "schema"];
        b(0.55, (pose) => ({ tY: carriageAt(pose)[1] + TRAY_AT[1] }), { hot });
        b(0.4, { tZ: TRAY_AT[2] + 3.9 }, { hot });
        b(0.4, { tZ: SLIP_CARRY + 3.6 }, { hot, start: (pose) => Object.assign(pose.slip, { at: "t", off: [0, 0, -3.6] }) });
        b(0.7, { tY: T.gaugeY }, { hot });
        if (ev.ok) {
          b(0.4, { tZ: T.gaugeZ + 1.4 }, { hot });
          b(0.4, { tZ: SLIP_CARRY + 3.6 }, { hot });
        } else {
          b(0.35, { tZ: T.gaugeZ + 5 }, { hot });
          b(0.12, { tZ: T.gaugeZ + 6.4 }, { hot });
          b(0.12, { tZ: T.gaugeZ + 5 }, { hot });
          b(0.35, { tZ: SLIP_CARRY + 3.6 }, { hot, end: (pose) => (pose.slip.vis = false) });
        }
        break;
      }
      case "permit": {
        const T = RIG.tools;
        const hot = ["thead", "tgrip", "slip", "bolt", "permit"];
        b(0.45, { tY: T.boltY + 7.4 }, { hot });
        if (ev.ok) {
          b(0.4, { bolt: 1 }, { hot });
          b(0.5, { tY: T.boltY - 6 }, { hot });
        } else {
          b(0.18, { tY: T.boltY + 6.2 }, { hot });
          b(0.18, { tY: T.boltY + 7.4 }, { hot });
          b(0.4, {}, { hot, end: (pose) => (pose.slip.vis = false) });
        }
        break;
      }
      case "execute":
      case "timeout": {
        const T = RIG.tools;
        if (ev.attempt === 1) {
          b(0.5, { tY: T.slotY }, { hot: ["thead", "tgrip", "slip"] });
          b(0.4, { tZ: T.slotZ + 1.2 }, { hot: ["thead", "tgrip", "slip"], end: (pose) => (pose.slip.vis = false) });
          b(0.3, { tZ: T.slotZ + 6 }, { hot: ["calculator"] });
        }
        if (ev.type === "execute") {
          b(0.9, (pose) => ({ crank: pose.crank + Math.PI * 4 }), { hot: ["calculator"], tick: (pose, t) => (pose.calc = spin(t, ev.result)) });
          b(0.3, {}, { hot: ["calculator"], start: (pose) => (pose.calc = calcText(ev.result)) });
        } else {
          b(0.5, (pose) => ({ crank: pose.crank + Math.PI * 0.6 }), { hot: ["calculator", "timer"] });
          b(1.3, { timer: 1 }, { hot: ["timer"] });
          b(0.35, {}, { hot: ["retries"], start: (pose) => (pose.flags[ev.attempt - 1] = 1) });
        }
        break;
      }
      case "backoff": {
        b(0.55, { timer: 0 }, { hot: ["timer"] });
        b(0.25, {}, { hot: ["retries"] });
        break;
      }
      case "observe": {
        const id = added[0];
        const i = slotOf(id);
        if (ev.observation === "feedback") {
          const Vf = RIG.verifier;
          b(0.3, { plunger: 0 }, { hot: ["verifier"], start: (pose) => (pose.slip.vis = false) });
          const y = carriageAt({ s: STOP.verifier })[1] + SLOT[i].y;
          b(0.25, {}, { hot: [`card${i}`], start: (pose) => Object.assign(pose.cards[i], { vis: true, kind: "feedback", at: "world", w: [Vf.feed[0], y, Vf.feed[2]] }) });
          b(0.7, { [`cards.${i}.w`]: [Vf.lip[0] - 2, y, Vf.lip[2] - 0.6] }, { hot: [`card${i}`] });
          b(0.45, (pose) => ({ [`cards.${i}.w`]: add(carriageAt(pose), [0, SLOT[i].y, SLOT[i].z]) }), { hot: [`card${i}`], end: (pose) => (pose.cards[i].at = "rack") });
          break;
        }
        const T = RIG.tools;
        const source = { result: [T.slotY, T.slotZ - 2], failed: [T.slotY, T.slotZ - 2], schema: [T.gaugeY, T.gaugeZ - 3], denied: [T.boltY + 7.4, SLIP_CARRY - 1] }[ev.observation];
        const hot = ["thead", "tgrip", `card${i}`];
        b(0.45, { tY: source[0], tZ: source[1] + CARD_HANG }, { hot, start: (pose) => Object.assign(pose.cards[i], { vis: true, kind: kindOf(id), at: "world", w: [T.x, source[0], source[1]] }) });
        b(0.55, { tZ: CARRY, bolt: 0 }, { hot, start: (pose) => Object.assign(pose.cards[i], { at: "t", off: [0, 0, -CARD_HANG] }) });
        b(0.9, (pose) => ({ tY: carriageAt(pose)[1] + SLOT[i].y }), { hot });
        b(0.5, { tZ: SLOT[i].z + CARD_HANG }, { hot });
        b(0.45, { tZ: GH }, { hot: ["thead", "tgrip"], start: (pose) => (pose.cards[i].at = "rack") });
        b(0.4, { tY: HOME_Y }, { hot: ["thead"] });
        break;
      }
      case "verify": {
        travel(STOP.verifier);
        const hot = ["plunger", "varm", "slip"];
        b(0.5, { plunger: -16.6 }, { hot });
        b(0.6, { needle: needleOf(ev.verdict) }, { hot });
        b(0.3, {}, { hot, start: (pose) => (pose.slip.stamp = ev.verdict.ok) });
        if (ev.verdict.ok) b(0.4, { plunger: 0, needle: 0 }, { hot });
        break;
      }
      case "bypass": {
        travel(STOP.verifier);
        b(0.6, {}, { hot: ["varm", "slip"] });
        break;
      }
      case "exit": {
        travel(STOP.exit);
        const E = RIG.exit;
        const hot = ["latch", "slip", "exit"];
        if (ev.outcome.proposal) {
          b(0.35, { latch: -3 }, { hot });
          b(0.3, (pose) => ({ "slip.w": add(carriageAt(pose), [0, TRAY_AT[1] + 4, TRAY_AT[2] - 2]) }), { hot, start: (pose) => Object.assign(pose.slip, { at: "world", w: add(carriageAt(pose), TRAY_AT) }) });
          b(0.7, { "slip.w": [E.ex, E.ey + 30, 5] }, { hot });
          b(0.5, { "slip.w": [E.ex, E.ey + 52, 3.2], latch: 0 }, { hot });
        } else {
          b(0.6, {}, { hot: ["carriage"] });
        }
        break;
      }
      case "limit": {
        b(0.9, {}, { hot: ["lamp"] });
        break;
      }
      default:
        b(0.3, {});
    }
    if (beats.length === mark) b(0.2, {});
    beats[mark].event = index;
    beats[mark].first = true;
  });
  return beats;
}

function relayout(pose, context, kindOf) {
  pose.cards.forEach((card, i) => {
    const id = context[i];
    card.vis = Boolean(id);
    card.at = "rack";
    if (id) card.kind = kindOf(id);
  });
}

function needleOf(verdict) {
  if (verdict.ok) return 0;
  if (verdict.code === "unsupported" || verdict.code === "uncited") return 1;
  return Math.max(-1, Math.min(1, (verdict.delta || 0) / 8));
}
const money = (n) => n.toLocaleString("en-US");
function calcText(result) {
  return (" " + money(result.diff)).slice(-6).padStart(6, " ");
}
function spin(t, result) {
  if (t > 0.92) return calcText(result);
  const n = Math.floor(t * 40);
  return String((n * 7919) % 999999).padStart(6, " ");
}

const state = {
  config: M.decode(location.search),
  sim: null,
  beats: [],
  bi: 0,
  bt: 0,
  pose: null,
  playing: false,
  stopAt: -1,
  speed: 1,
  done: false,
  shown: -1,
  trace: [],
  explode: { target: 0, shares: {} },
  selected: null,
};
D.ASSEMBLIES.forEach((asm) => (state.explode.shares[asm] = { x: 0, v: 0 }));

function load(config, { autoplay = false } = {}) {
  state.config = M.configOf(config);
  state.sim = M.simulate(state.config);
  state.beats = beatsFor(state.sim);
  state.pose = freshPose(state.config);
  state.bi = 0;
  state.bt = 0;
  state.done = false;
  state.shown = -1;
  state.trace = [];
  state.stopAt = -1;
  syncControls();
  writeUrl();
  renderPanels(null);
  draw();
  if (autoplay) play();
  else pause();
}

function beatDuration(beat) {
  if (beat.d === "travel") {
    const from = state.pose.s;
    const to = nextS(from, beat.stop);
    beat._to = to;
    return to - from < 0.5 ? 0.05 : 0.35 + (to - from) / 150;
  }
  return beat.d;
}
function beginBeat(beat) {
  beat._dur = beatDuration(beat);
  if (beat.first) onEvent(beat.event);
  if (beat.start) beat.start(state.pose);
  const to = beat.d === "travel" ? { s: beat._to } : typeof beat.to === "function" ? beat.to(state.pose) : beat.to || {};
  beat._target = to;
  beat._from = {};
  for (const key of Object.keys(to)) beat._from[key] = clone(getPath(state.pose, key));
  state.pose.hot = beat.hot || [];
}
function applyBeat(beat, t) {
  const e = ease(t);
  for (const [key, target] of Object.entries(beat._target)) {
    const from = beat._from[key];
    setPath(state.pose, key, Array.isArray(target) ? target.map((v, i) => lerp(from[i], v, e)) : lerp(from, target, e));
  }
  if (beat.tick) beat.tick(state.pose, t);
}
function endBeat(beat) {
  applyBeat(beat, 1);
  if (beat.end) beat.end(state.pose);
}

function advance(dt) {
  let left = dt;
  while (left > 0 && state.bi < state.beats.length) {
    const beat = state.beats[state.bi];
    if (state.bt === 0 && !beat._begun) {
      if (state.stopAt >= 0 && beat.first && beat.event > state.stopAt) {
        state.playing = false;
        state.stopAt = -1;
        syncButtons();
        return;
      }
      beginBeat(beat);
      beat._begun = true;
    }
    const remaining = beat._dur - state.bt;
    if (left >= remaining) {
      endBeat(beat);
      left -= remaining;
      state.bi += 1;
      state.bt = 0;
    } else {
      state.bt += left;
      applyBeat(beat, state.bt / beat._dur);
      left = 0;
    }
  }
  if (state.bi >= state.beats.length && !state.done) {
    state.done = true;
    state.playing = false;
    state.pose.hot = ["slip"];
    renderPanels(state.sim.events.length - 1, true);
    syncButtons();
  }
}

function onEvent(index) {
  const ev = state.sim.events[index];
  state.shown = index;
  state.trace.push(ev);
  renderPanels(index);
  announce(ev);
}

const explodeVec = (asm) => mul(D.EXPLODE[asm] || ZERO, state.explode.shares[asm] ? state.explode.shares[asm].x : 0);
let lastOrder = "";
const drawerCache = new Map();

function draw() {
  const pose = state.pose;
  const C = carriageAt(pose);
  const T = {};
  const ex = (asm) => explodeVec(asm);
  for (const item of D.items) T[item.id] = ex(item.asm);
  T.carriage = add(C, ex("carriage"));
  pose.cards.forEach((card, i) => {
    const anchor = cardAnchor(pose, i);
    T[`card${i}`] = add(sub(anchor, [0, SLOT[i].y, SLOT[i].z]), card.at === "rack" ? ex("carriage") : ZERO);
  });
  T.slip = add(sub(slipAnchor(pose), TRAY_AT), pose.slip.at === "tray" ? ex("carriage") : ZERO);
  T.rhead = add([0, pose.rY - HOME_Y, 0], ex("retrieval"));
  T.rgrip = add([0, pose.rY - HOME_Y, pose.rZ - GH], ex("retrieval"));
  T.thead = add([0, pose.tY - HOME_Y, 0], ex("tools"));
  T.tgrip = add([0, pose.tY - HOME_Y, pose.tZ - GH], ex("tools"));
  T.mhead = add([0, 0, pose.mZ], ex("model"));
  T.bolt = add([pose.bolt * 9.5, 0, 0], ex("tools"));
  T.varm = add([0, 0, pose.varm], ex("verifier"));
  T.plunger = add([0, 0, pose.varm + pose.plunger], ex("verifier"));
  T.latch = add([0, 0, pose.latch], ex("exit"));
  T.lockout = add([0, 0, (1 - pose.lock) * 18], ex("retrieval"));

  const keyed = D.items.map((item) => [item.id, item.key + dot(T[item.id], V)]);
  keyed.sort((a, b) => a[1] - b[1]);
  const order = keyed.map((entry) => entry[0]).join(",");
  for (const item of D.items) {
    const t = T[item.id];
    const node = nodes[item.id];
    const text = t[0] || t[1] || t[2] ? K.translateAlong(P, t) : "";
    if (node._t !== text) {
      if (text) node.setAttribute("transform", text);
      else node.removeAttribute("transform");
      node._t = text;
    }
  }
  if (order !== lastOrder) {
    const fragment = document.createDocumentFragment();
    keyed.forEach(([id]) => fragment.appendChild(nodes[id]));
    layer.appendChild(fragment);
    lastOrder = order;
  }

  pose.cards.forEach((card, i) => {
    const group = live(`card${i}`);
    const display = card.vis ? "" : "none";
    if (group.style.display !== display) group.style.display = display;
    if (group._kind !== card.kind) {
      group.querySelectorAll("[data-tab]").forEach((tab) => (tab.style.display = tab.dataset.tab === card.kind ? "" : "none"));
      group._kind = card.kind;
    }
  });
  const slip = live("slip");
  slip.style.display = pose.slip.vis ? "" : "none";
  slip.querySelector("[data-stamp]").style.display = pose.slip.stamp ? "" : "none";

  const rod = (tag, z) => {
    const x = tag === "r" ? RIG.retrieval.x : RIG.tools.x;
    live(`${tag}rod`).setAttribute("d", K.segment([x, HOME_Y, D.GANTRY_Z - 8 - (z - GH)], [x, HOME_Y, GH + 2.6], P));
  };
  rod("r", pose.rZ);
  rod("t", pose.tZ);

  const open = Math.round(pose.drawer * 4) / 4;
  const drawer = live("drawer");
  if (drawer._open !== open) {
    if (!drawerCache.has(open)) drawerCache.set(open, drawerSvg(open));
    drawer.innerHTML = drawerCache.get(open);
    drawer._open = open;
  }
  const lock = live("lockout");
  lock.style.opacity = String(pose.lock);

  const Tl = RIG.tools;
  const [cx, cy, cz] = Tl.crank;
  live("crank").setAttribute("d", K.segment([cx, cy, cz], [cx, cy + Math.cos(pose.crank) * 4.4, cz + Math.sin(pose.crank) * 4.4], P));
  const ta = pose.timer * Math.PI * 1.8;
  live("timer").setAttribute("d", K.lineOnTop(Tl.timer, [Tl.timer[0] + Math.sin(ta) * 4.8, Tl.timer[1] - Math.cos(ta) * 4.8], Tl.flagsZ + 7.2, P));
  pose.flags.forEach((flag, i) => {
    const node = live(`flag${i}`);
    node.style.opacity = String(flag);
  });
  const na = pose.needle * Math.PI * 0.72;
  const dial = RIG.verifier.dial;
  live("vneedle").setAttribute("d", K.lineOnTop(dial, [dial[0] + Math.sin(na) * 7.6, dial[1] - Math.cos(na) * 7.6], RIG.verifier.dialZ, P));
  setText("calc", pose.calc);

  const ev = state.shown >= 0 ? state.sim.events[state.shown] : null;
  const steps = ev ? ev.index + 1 : 0;
  const odo = String(steps).padStart(5, "0");
  for (let i = 0; i < 5; i++) setText(`odo${i}`, odo[i]);
  setText("laps", "L" + (ev ? ev.laps : 0));
  const clock = ev ? ev.clock : 0;
  const ca = (clock / 12000) * Math.PI * 2;
  const cd = RIG.clock;
  live("clock").setAttribute("d", K.lineOnTop([cd.x - Math.sin(ca) * 2.5, cd.y + Math.cos(ca) * 2.5], [cd.x + Math.sin(ca) * 10.5, cd.y - Math.cos(ca) * 10.5], cd.z, P));
  const turns = ev ? ev.turn : 0;
  const qa = -Math.PI / 2 - Math.PI * 0.4 + (Math.min(turns, 4) * Math.PI * 0.8) / 4 + Math.PI / 2;
  const q = RIG.quad;
  live("turns").setAttribute("d", K.lineOnTop([q.x, q.y], [q.x + Math.sin(qa) * 6, q.y - Math.cos(qa) * 6], q.z, P));
  const cores = state.explode.shares.model.x;
  live("mcore").style.opacity = String(Math.min(1, cores * 1.6));
  live("ccore").style.opacity = String(Math.min(1, state.explode.shares.controller.x * 1.6));
  drawTape();

  const hot = new Set(pose.hot);
  if (state.selected) D.items.forEach((item) => item.asm === state.selected && hot.add(item.id));
  for (const id of Array.from(hot)) if (meta[id] && nodes[`tag-${meta[id].asm}`]) hot.add(`tag-${meta[id].asm}`);
  for (const item of D.items) {
    const on = hot.has(item.id);
    const node = nodes[item.id];
    if (on !== node._hot) {
      if (on) node.setAttribute("data-hot", "");
      else node.removeAttribute("data-hot");
      node._hot = on;
    }
  }
  if (!hot.size && state.selected === null && pose.cards[0].vis) nodes.card0.setAttribute("data-hot", "");
}

function setText(name, value) {
  const node = live(name);
  if (node && node.textContent !== value) node.textContent = value;
}

function drawerSvg(open) {
  const R = RIG.retrieval;
  const cab = R.cab;
  const face = R.face;
  const [z0, z1] = R.drawers[1];
  const box = (x0, y0, za, x1, y1, zb, tone, r = 0.4) => K.solidSvg(K.slabOf({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r }, za, zb - za, P, r ? 3 : 1), { tone });
  const out = [];
  const yF = face + open;
  if (open > 0.4) {
    out.push(box(cab.x + 4, face - 0.2, z0 + 0.6, cab.x + cab.w - 4, yF, z1 - 1.5, "lo", 0));
    const tops = [];
    for (let i = 0; i < 7; i++) {
      const y = yF - 2 - i * 2.6;
      if (y < face + 0.8) break;
      tops.push(K.lineOnTop([cab.x + 7, y], [cab.x + cab.w - 7, y], z1 - 2.2, P));
    }
    out.push(K.lineSvg(tops.join(""), { tone: "mid" }));
  }
  out.push(box(cab.x + 3, yF, z0, cab.x + cab.w - 3, yF + 1.2, z1, "mid"));
  const cx = cab.x + cab.w / 2;
  out.push(box(cx - 7, yF + 1.2, z1 - 6.4, cx + 7, yF + 1.7, z1 - 2.4, "lo", 0));
  out.push(box(cx - 5, yF + 1.2, z0 + 2.6, cx + 5, yF + 3.6, z0 + 4.4, "hi", 0.6));
  return out.join("");
}

function drawTape() {
  const tape = live("tape");
  const key = state.trace.length;
  if (tape._key === key) return;
  tape._key = key;
  const Pr = RIG.printer;
  const lines = state.trace.slice(-6).reverse();
  tape.innerHTML = lines
    .map((ev, n) => {
      const y = Pr.t0 + 4.6 + n * 5;
      if (y > Pr.t1 - 1) return "";
      const text = `${String(ev.index + 1).padStart(2, "0")} ${ev.type}`;
      return `<text class="iso-face-text" data-tone="${n === 0 ? "hi" : "mid"}" transform="${K.topMatrix([Pr.x0, y], 0.32, P, "x")}" font-size="3">${text}</text>`;
    })
    .join("");
}

let frame = 0;
let last = 0;
let visible = true;
function tick(now) {
  if (state.recording) {
    frame = 0;
    last = 0;
    return;
  }
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
  last = now;
  if (state.playing) advance(dt * state.speed * (still.matches ? 40 : 1));
  const moving = stepExplode(dt);
  draw();
  frame = visible && (state.playing || moving) ? requestAnimationFrame(tick) : 0;
  if (!frame) last = 0;
}
function kick() {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
}
new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) kick();
}, { rootMargin: "120px 0px" }).observe(stage);

const SPRING = { stiffness: 64, damping: 14.2, stagger: 0.04 };
function stepExplode(dt) {
  let moving = false;
  const order = state.explode.target ? D.ASSEMBLIES : D.ASSEMBLIES.slice().reverse();
  order.forEach((asm, index) => {
    const share = state.explode.shares[asm];
    const delay = index * SPRING.stagger;
    share.wait = share.wait === undefined ? 0 : share.wait;
    if (share.goal !== state.explode.target) {
      share.goal = state.explode.target;
      share.wait = delay;
    }
    if (share.wait > 0) {
      share.wait -= dt;
      moving = true;
      return;
    }
    if (still.matches) {
      share.x = share.goal;
      share.v = 0;
      return;
    }
    for (let i = 0; i < 4; i++) {
      const h = dt / 4;
      share.v += (SPRING.stiffness * (share.goal - share.x) - SPRING.damping * share.v) * h;
      share.x += share.v * h;
    }
    if (Math.abs(share.goal - share.x) < 5e-4 && Math.abs(share.v) < 5e-4) {
      share.x = share.goal;
      share.v = 0;
    } else moving = true;
  });
  return moving;
}

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

const BREAK_ORDER = [
  { label: "retrieval", config: { retrieval: false } },
  { label: "verification, with a tool that always times out", config: { verification: false, fault: "timeout-always" } },
  { label: "tool access", config: { tools: false } },
  { label: "the tool call schema", config: { fault: "malformed" } },
];
let breakIndex = 0;
function breakOne() {
  const choice = BREAK_ORDER[breakIndex % BREAK_ORDER.length];
  breakIndex += 1;
  load({ ...M.DEFAULTS, ...choice.config }, { autoplay: true });
  flash(`Broke ${choice.label}. Same request, replayed.`);
}
function repair() {
  load(M.DEFAULTS, { autoplay: true });
  flash("Every dependency restored. Same request, replayed.");
}
function toggleExplode() {
  state.explode.target = state.explode.target ? 0 : 1;
  if (state.explode.target) state.playing = false;
  syncButtons();
  kick();
}

function syncControls() {
  const c = state.config;
  $("#am-retrieval").checked = c.retrieval;
  $("#am-tools").checked = c.tools;
  $("#am-verify").checked = c.verification;
  $("#am-fault").value = c.fault;
}
function syncButtons() {
  const run = $("[data-am-run]");
  run.textContent = state.playing ? "Pause" : state.done ? "Run again" : state.shown >= 0 ? "Resume" : "Run";
  run.setAttribute("aria-pressed", String(state.playing));
  $("[data-am-explode]").setAttribute("aria-pressed", String(Boolean(state.explode.target)));
  $("[data-am-explode]").textContent = state.explode.target ? "Assemble" : "Explode";
}
function writeUrl() {
  const query = M.encode(state.config);
  const url = location.pathname + (query ? "?" + query : "") + location.hash;
  history.replaceState(null, "", url);
}
let flashTimer = 0;
function flash(text) {
  const node = $("[data-am-flash]");
  node.textContent = text;
  node.dataset.on = "";
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => delete node.dataset.on, 3200);
}
const politely = $("[data-am-live]");
function announce(ev) {
  if (ev.type === "exit") politely.textContent = "Run finished: " + ev.outcome.status + ". " + ev.outcome.text;
}

const STAGE_NAMES = {
  intake: "Intake: request card enters",
  memory: "Memory: saved preference loaded",
  retrieve: "Retrieval: invoices pulled from the cabinet",
  "retrieve-off": "Retrieval: locked out, no documents",
  model: "Model: reads the context, proposes a move",
  schema: "Schema gauge: checks the tool call",
  permit: "Permission bolt: may this tool run?",
  execute: "Tool: calculator runs",
  timeout: "Tool: no reply before the timer ran out",
  backoff: "Retry: wait, then try again",
  observe: "Observation: result returned to the context",
  verify: "Verifier: recomputes from the evidence",
  bypass: "Verifier: switched off, nothing checked",
  limit: "Runtime: turn limit reached",
  exit: "Exit: answer and trace leave the machine",
};

function renderPanels(index, final = false) {
  const sim = state.sim;
  const ev = index === null || index < 0 ? null : sim.events[index];
  const corner = document.querySelector("[data-readout]");
  const stageText = ev ? STAGE_NAMES[ev.type] : "Ready · press Run";
  if (corner) corner.textContent = ev ? `step ${ev.index + 1} of ${sim.events.length} · ${ev.type}` : `ready · ${sim.events.length} steps queued`;
  $("[data-am-stage-name]").textContent = stageText;
  const evidence = ev ? ev.evidence : [];
  $("[data-am-evidence]").textContent = evidence.length ? evidence.join(", ") : "none";
  $("[data-am-calls]").textContent = ev ? `${ev.calls} call${ev.calls === 1 ? "" : "s"} · ${ev.attempts} attempt${ev.attempts === 1 ? "" : "s"}` : "0 calls";
  const verdict = ev && ev.verdict ? (ev.verdict.ok ? "passed · " + ev.verdict.code : "rejected · " + ev.verdict.code) : state.config.verification ? "not run yet" : "switched off";
  $("[data-am-verdict]").textContent = verdict;
  $("[data-am-steps]").textContent = ev ? `${ev.index + 1} / ${sim.events.length} · turn ${ev.turn} of ${M.LIMITS.turns}` : `0 / ${sim.events.length}`;
  $("[data-am-clock]").textContent = ev ? (ev.clock / 1000).toFixed(2) + " s" : "0.00 s";
  const list = $("[data-am-trace]");
  list.innerHTML = state.trace
    .map((item) => `<li data-type="${item.type}"><span class="am-n">${String(item.index + 1).padStart(2, "0")}</span><span class="am-t">${item.type}</span><span class="am-d">${escapeHtml(item.trace)}</span><span class="am-c">+${item.cost} ms</span></li>`)
    .join("");
  list.scrollTop = list.scrollHeight;
  const out = $("[data-am-output]");
  const status = $("[data-am-status]");
  const truth = $("[data-am-truth]");
  if (final || (ev && ev.type === "exit")) {
    const o = sim.outcome;
    status.textContent = o.status;
    status.dataset.status = o.status;
    out.textContent = o.text;
    truth.innerHTML = truthNote(o);
  } else {
    status.textContent = ev ? "running" : "waiting";
    status.dataset.status = ev ? "running" : "idle";
    out.textContent = ev && ev.proposal && ev.proposal.kind === "answer" ? "Draft: " + ev.proposal.text : "No answer yet.";
    truth.textContent = "";
  }
  if (ev) {
    const contextIds = ev.context;
    $("[data-am-context]").innerHTML = contextIds.map((id) => `<li>${escapeHtml(id)}</li>`).join("") || "<li>empty</li>";
  } else $("[data-am-context]").innerHTML = "<li>empty</li>";
}

function truthNote(outcome) {
  const fixture = "The fixture answer is $3,100, an increase of 25.0% over April.";
  if (outcome.status === "verified") return `Checked and correct. ${fixture}`;
  if (outcome.status === "declined") return "The agent said it could not answer. With no invoices in its context, that is the honest result. Switch retrieval back on to see it compute.";
  if (outcome.status === "failed") return `The run stopped inside its limits and left a trace. ${fixture}`;
  if (outcome.correct) return `Nothing checked this answer. It happens to be right this time. ${fixture}`;
  return `<strong>Nothing checked this answer, and it is wrong.</strong> ${fixture}`;
}
function escapeHtml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

$("[data-am-run]").addEventListener("click", () => (state.playing ? pause() : play()));
$("[data-am-step]").addEventListener("click", step);
$("[data-am-break]").addEventListener("click", breakOne);
$("[data-am-repair]").addEventListener("click", repair);
$("[data-am-explode]").addEventListener("click", toggleExplode);
$("[data-am-reset]").addEventListener("click", () => {
  state.explode.target = 0;
  state.selected = null;
  inspect(null);
  load(M.DEFAULTS);
  kick();
});
const configFromForm = () => ({ retrieval: $("#am-retrieval").checked, tools: $("#am-tools").checked, verification: $("#am-verify").checked, fault: $("#am-fault").value });
["#am-retrieval", "#am-tools", "#am-verify", "#am-fault"].forEach((selector) =>
  $(selector).addEventListener("change", () => load(configFromForm(), { autoplay: state.playing || state.shown >= 0 })),
);
$$("[data-am-speed]").forEach((button) =>
  button.addEventListener("click", () => {
    state.speed = Number(button.dataset.amSpeed);
    $$("[data-am-speed]").forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
  }),
);
$$("[data-am-scenario]").forEach((button) =>
  button.addEventListener("click", () => {
    load({ ...M.DEFAULTS, ...JSON.parse(button.dataset.amScenario) }, { autoplay: true });
    $$("[data-am-scenario]").forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
    showTab("run");
  }),
);
$("[data-am-share]").addEventListener("click", async () => {
  const url = location.href;
  try {
    await navigator.clipboard.writeText(url);
    flash("Link copied. It opens with these switches set.");
  } catch (error) {
    flash(url);
  }
});

function showTab(name) {
  $$("[data-am-tab]").forEach((tab) => {
    const on = tab.dataset.amTab === name;
    tab.setAttribute("aria-selected", String(on));
    tab.tabIndex = on ? 0 : -1;
  });
  $$("[data-am-panel]").forEach((panel) => (panel.hidden = panel.dataset.amPanel !== name));
}
$$("[data-am-tab]").forEach((tab, index, tabs) => {
  tab.addEventListener("click", () => showTab(tab.dataset.amTab));
  tab.addEventListener("keydown", (event) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = tabs[(index + step + tabs.length) % tabs.length];
    showTab(next.dataset.amTab);
    next.focus();
  });
});

function inspect(asm) {
  state.selected = asm;
  const panel = $("[data-am-inspect]");
  const info = asm ? D.INFO[asm] : null;
  $$("[data-am-part]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.amPart === asm)));
  if (!info) {
    panel.innerHTML = `<p class="am-muted">Select a part of the machine, or pick one from the list, to see what it stands for in a real agent.</p>`;
    kick();
    return;
  }
  const deep = document.body.dataset.amDepth === "deep";
  panel.innerHTML = `<p class="am-label">${D.CONCEPT[asm]}</p><h3>${info.name}</h3><p class="am-kicker">${info.is}</p><dl><dt>What it does</dt><dd>${info.does}</dd><dt>Why you need it</dt><dd>${info.why}</dd><dt>Without it</dt><dd>${info.without}</dd>${deep ? `<dt>In code</dt><dd>${info.code}</dd>` : ""}</dl><a class="am-lesson" href="${info.lesson.href}">Lesson: ${info.lesson.title} →</a>`;
  kick();
}
$$("[data-am-part]").forEach((button) => button.addEventListener("click", () => inspect(state.selected === button.dataset.amPart ? null : button.dataset.amPart)));
$$("[data-am-depth]").forEach((button) =>
  button.addEventListener("click", () => {
    document.body.dataset.amDepth = button.dataset.amDepth;
    $$("[data-am-depth]").forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
    inspect(state.selected);
  }),
);
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
  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    state.playing ? pause() : play();
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    step();
  } else if (event.key === "e" || event.key === "E") toggleExplode();
  else if (event.key === "b" || event.key === "B") breakOne();
  else if (event.key === "r" || event.key === "R") repair();
});

const TOUR = D.TOUR;
let tourAt = -1;
function showTour(index) {
  tourAt = Math.max(0, Math.min(TOUR.length - 1, index));
  const item = TOUR[tourAt];
  $("[data-am-tour-n]").textContent = `${tourAt + 1} / ${TOUR.length}`;
  $("[data-am-tour-title]").textContent = item.title;
  $("[data-am-tour-text]").textContent = item.text;
  $("[data-am-tour-prev]").disabled = tourAt === 0;
  $("[data-am-tour-next]").textContent = tourAt === TOUR.length - 1 ? "Done" : "Next";
  if (item.part) {
    inspect(item.part);
    showTab("inspect");
  }
  if (item.config) load({ ...M.DEFAULTS, ...item.config }, { autoplay: true });
}
$("[data-am-tour-start]").addEventListener("click", () => {
  $("[data-am-tour]").hidden = false;
  showTour(0);
});
$("[data-am-tour-prev]").addEventListener("click", () => showTour(tourAt - 1));
$("[data-am-tour-next]").addEventListener("click", () => {
  if (tourAt === TOUR.length - 1) {
    $("[data-am-tour]").hidden = true;
    return;
  }
  showTour(tourAt + 1);
});

window.__agentMachine = { state, load, play, pause, step, breakOne, repair, toggleExplode, inspect, finish: () => advance(1e6), seek: (n) => { state.stopAt = n; state.playing = true; advance(1e6); state.playing = false; draw(); }, by: (sec) => { state.playing = true; advance(sec); state.playing = false; draw(); } };
load(state.config);
let started = false;
if (document.documentElement.hasAttribute("data-poster")) {
  started = true;
  window.__agentMachine.seek(3);
  state.pose.hot = ["mhead", "slip"];
  draw();
}
new IntersectionObserver((entries) => {
  const entry = entries[entries.length - 1];
  if (entry.isIntersecting && !started && !still.matches && !/[?&]still\b/.test(location.search)) {
    started = true;
    setTimeout(() => state.shown < 0 && !state.playing && play(), 900);
  }
}, { threshold: 0.35 }).observe(stage);
