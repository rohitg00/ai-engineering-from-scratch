import * as k from "./kit/iso-kit.mjs";
import * as G from "./kit/lathe.mjs";
import { CONCEPT } from "./content.mjs";

export const W = 960;
export const H = 640;
export const AZIMUTH = 60;

export const PLATE = { x: -200, y: -164, w: 398, d: 292, r: 10 };
export const PLATE_H = 10;
export const FOOT_H = 5;
export const TRACK = { x: -110, y: -55, w: 220, d: 110, r: 30 };
export const BED_Z = 3;
export const KERB = [4, 9];
export const KERB_TOP = 5.5;
export const PUCK = { r: 18, z: 6, h: 4 };
export const RACK = { x: -9, w: 18, y0: -12, pitch: 2.1, rise: 1.6, z: 11.5, h: 12, t: 0.8, slots: 8 };
export const slotOf = (i) => ({ y: RACK.y0 + i * RACK.pitch, z: RACK.z + (RACK.slots - 1 - i) * RACK.rise });
export const TRAY = { x: -7, y: 6.6, w: 14, d: 6.4, z: 10 };

const STRAIGHT_SIDE = TRACK.d - TRACK.r * 2;
const STRAIGHT_LONG = TRACK.w - TRACK.r * 2;
const ARC = (Math.PI / 2) * TRACK.r;
export const LOOP = 2 * STRAIGHT_SIDE + 2 * STRAIGHT_LONG + 4 * ARC;

const X0 = TRACK.x;
const X1 = TRACK.x + TRACK.w;
const Y0 = TRACK.y;
const Y1 = TRACK.y + TRACK.d;
const R = TRACK.r;

export function trackPoint(s) {
  let t = ((s % LOOP) + LOOP) % LOOP;
  const legs = [
    [STRAIGHT_SIDE, (u) => [X0, Y1 - R - u]],
    [ARC, (u) => arcAt(X0 + R, Y0 + R, Math.PI + u / R)],
    [STRAIGHT_LONG, (u) => [X0 + R + u, Y0]],
    [ARC, (u) => arcAt(X1 - R, Y0 + R, (3 * Math.PI) / 2 + u / R)],
    [STRAIGHT_SIDE, (u) => [X1, Y0 + R + u]],
    [ARC, (u) => arcAt(X1 - R, Y1 - R, u / R)],
    [STRAIGHT_LONG, (u) => [X1 - R - u, Y1]],
    [ARC, (u) => arcAt(X0 + R, Y1 - R, Math.PI / 2 + u / R)],
  ];
  for (const [length, at] of legs) {
    if (t <= length) return at(t);
    t -= length;
  }
  return [X0, Y1 - R];
}
function arcAt(cx, cy, angle) {
  return [cx + R * Math.cos(angle), cy + R * Math.sin(angle)];
}

const sAt = (leg, u) => {
  const lengths = [STRAIGHT_SIDE, ARC, STRAIGHT_LONG, ARC, STRAIGHT_SIDE, ARC, STRAIGHT_LONG, ARC];
  return lengths.slice(0, leg).reduce((a, b) => a + b, 0) + u;
};

export const STOPS = {
  intake: sAt(0, 12),
  memory: sAt(0, 44),
  retrieval: sAt(2, 4),
  model: sAt(2, 88),
  tools: sAt(2, 146),
  verifier: sAt(4, 49),
  exit: sAt(6, 36),
};

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [10, -120, 80], [-60, -140, 80]],
  W,
  H,
  { pad: 26, azimuth: AZIMUTH },
);
export const V = G.viewOf(P);
export const KS = G.scaleOf(P);
export const at = (p) => k.iso(p, P);
export const depth = (p) => G.dot3(p, V);

const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const box = (x0, y0, z0, x1, y1, z1, style = {}, { r = 0.6, steps = 3, bevel = 0, inner = "" } = {}) =>
  S(k.slabOf({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r }, z0, z1 - z0, P, steps, bevel), { tone: "mid", ...style, inner });
const post = (x, y, r, z0, z1, style = {}, steps = 24) => S(k.cylinder(x, y, r, z0, z1 - z0, P, steps), { tone: "mid", ...style });
const screws = (points, size = 0.45, tone = "mid") => Dots(points.map(at), { size, tone });
const seam = (plan, z, steps = 3) => Ln(k.sideSeam(plan, z, P, steps), { tone: "faint" });
const along = (axis) => (axis === "x" ? [1, 0, 0] : axis === "y" ? [0, 1, 0] : [0, 0, 1]);
function rod(o, axis, length, r, style = {}, { rims = "all", steps } = {}) {
  const F = G.frameAlong(o, along(axis));
  return S(G.disc(0, length, r, F, P, { rims, ...(steps ? { steps } : {}) }), { tone: "mid", ...style });
}
function faceText(plane, origin, text, size, tone = "mid", anchor = "start", attrs = "") {
  const matrix = plane === "top" ? k.topMatrix(origin, origin[2], P, "x") : plane === "front" ? k.sideMatrix([origin[0], origin[1]], origin[2], P, "left") : k.sideMatrix([origin[0], origin[1]], origin[2], P, "right");
  return `<text class="iso-face-text" data-tone="${tone}" transform="${matrix}" font-size="${size}" text-anchor="${anchor}"${attrs}>${text}</text>`;
}

export const items = [];
export const EXPLODE = {
  base: [0, 0, 0],
  track: [0, 0, 0],
  core: [0, 0, 0],
  controller: [0, 6, 44],
  intake: [-46, 18, 12],
  memory: [-50, -14, 16],
  retrieval: [-34, -40, 26],
  model: [4, -46, 52],
  tools: [40, -44, 30],
  verifier: [52, 6, 22],
  exit: [18, 46, 8],
  printer: [-16, 50, 8],
  carriage: [0, 0, 34],
};
export const ASSEMBLIES = Object.keys(EXPLODE);

function put(id, asm, ref, svg, { bias = 0, live = null, part = asm } = {}) {
  items.push({ id, asm, part, ref, key: depth(ref) + bias, svg, live });
}

function basePlate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  const feet = k.corners(PLATE, 24).sort((a, b) => depth([a[0], a[1], 0]) - depth([b[0], b[1], 0]));
  for (const [x, y] of feet) {
    out.push(S(k.cylinder(x, y, 8, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 6.2, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: Ln(k.sideSeam(PLATE, -4, P, 8), { tone: "faint" }) }));
  out.push(Ln(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const corners = k.corners(PLATE, 11);
  out.push(Ln(corners.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(screws(corners.map(([x, y]) => [x, y, 0]), 0.55));
  const strip = { x: -150, y: PLATE.y + PLATE.d - 14, w: 150, d: 6, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y, 0.6, [1.8, 3.4], P);
  out.push(Ln(ticks.minor, { tone: "lo" }), Ln(ticks.major, { tone: "mid" }));
  out.push(screws([[strip.x + 2, strip.y + 3, 0.6], [strip.x + strip.w - 2, strip.y + 3, 0.6]], 0.4));
  const label = { x: 68, y: PLATE.y + PLATE.d - 26, w: 40, d: 15, r: 1.4 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo" }));
  out.push(Ln(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 4), { tone: "faint" }));
  out.push(faceText("top", [label.x + 4, label.y + 6.6, 0.8], "AGENT RUNTIME", 3.2, "mid"));
  out.push(Ln(k.lineOnTop([label.x + 4, label.y + 9.6], [label.x + 28, label.y + 9.6], 0.8, P), { tone: "lo", free: true }));
  out.push(Ln(k.lineOnTop([label.x + 4, label.y + 11.8], [label.x + 20, label.y + 11.8], 0.8, P), { tone: "lo", free: true }));
  out.push(screws([[label.x + 2, label.y + 2, 0.8], [label.x + label.w - 2, label.y + label.d - 2, 0.8]], 0.4));
  put("plate", "base", [0, 0, -100], out.join(""), { bias: -1000 });
}

function annulusSector(cx, cy, r0, r1, a0, a1, steps = 10) {
  const outer = [];
  const inner = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    outer.push([cx + r1 * Math.cos(a), cy + r1 * Math.sin(a)]);
    inner.push([cx + r0 * Math.cos(a), cy + r0 * Math.sin(a)]);
  }
  return [...outer, ...inner.reverse()];
}

function trackBed() {
  const out = [];
  const bed = k.insetPlan(TRACK, -16);
  out.push(`<path class="iso-halo" d="${k.haloOf(bed, 0, BED_Z, P)}" style="opacity:.25"/>`);
  out.push(S(k.slabOf(bed, 0, BED_Z, P, 10, 0.8), { tone: "mid" }));
  out.push(Ln(k.planOutline(TRACK, BED_Z, P, 12), { tone: "lo" }));
  out.push(Ln(k.planOutline(k.insetPlan(TRACK, -1.2), BED_Z, P, 12) + k.planOutline(k.insetPlan(TRACK, 1.2), BED_Z, P, 12), { tone: "faint" }));
  const pieces = [];
  for (const [r0, r1, name] of [[-KERB[1], -KERB[0], "outer"], [KERB[0], KERB[1], "inner"]]) {
    const lo = TRACK.r + (name === "outer" ? KERB[0] : -KERB[1]);
    const hi = TRACK.r + (name === "outer" ? KERB[1] : -KERB[0]);
    const corners = [
      [X0 + R, Y0 + R, Math.PI, Math.PI * 1.5],
      [X1 - R, Y0 + R, Math.PI * 1.5, Math.PI * 2],
      [X1 - R, Y1 - R, 0, Math.PI / 2],
      [X0 + R, Y1 - R, Math.PI / 2, Math.PI],
    ];
    for (const [cx, cy, a0, a1] of corners) {
      const ring = annulusSector(cx, cy, lo, hi, a0, a1, 12);
      const mid = [cx + ((lo + hi) / 2) * Math.cos((a0 + a1) / 2), cy + ((lo + hi) / 2) * Math.sin((a0 + a1) / 2), KERB_TOP];
      pieces.push([mid, S(k.extrude(ring, BED_Z, KERB_TOP - BED_Z, P, { convex: false }), { tone: "mid" })]);
    }
    const w = hi - lo;
    const outerSide = name === "outer";
    const yBack = outerSide ? Y0 - KERB[1] : Y0 + KERB[0];
    const yFront = outerSide ? Y1 + KERB[0] : Y1 - KERB[1];
    const xLeft = outerSide ? X0 - KERB[1] : X0 + KERB[0];
    const xRight = outerSide ? X1 + KERB[0] : X1 - KERB[1];
    pieces.push([[0, yBack + w / 2, KERB_TOP], box(X0 + R, yBack, BED_Z, X1 - R, yBack + w, KERB_TOP, {}, { r: 0, steps: 1 })]);
    pieces.push([[0, yFront + w / 2, KERB_TOP], box(X0 + R, yFront, BED_Z, X1 - R, yFront + w, KERB_TOP, {}, { r: 0, steps: 1 })]);
    pieces.push([[xLeft + w / 2, 0, KERB_TOP], box(xLeft, Y0 + R, BED_Z, xLeft + w, Y1 - R, KERB_TOP, {}, { r: 0, steps: 1 })]);
    pieces.push([[xRight + w / 2, 0, KERB_TOP], box(xRight, Y0 + R, BED_Z, xRight + w, Y1 - R, KERB_TOP, {}, { r: 0, steps: 1 })]);
  }
  pieces.sort((a, b) => depth(a[0]) - depth(b[0]));
  out.push(...pieces.map(([, svg]) => svg));
  const ties = [];
  for (let s = 6; s < LOOP; s += 12) {
    const [x, y] = trackPoint(s);
    ties.push([x, y, BED_Z]);
  }
  out.push(Dots(ties.map(at), { size: 0.38, tone: "lo" }));
  put("track", "track", [0, 0, -50], out.join(""), { bias: -500 });
}

function controller() {
  const base = { x: -64, y: -26, w: 128, d: 52, r: 6 };
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(base, BED_Z, 2, P)}" style="opacity:.4"/>`);
  out.push(S(k.slabOf(base, BED_Z, 3, P, 6, 0.8), { tone: "lo" }));
  const deck = k.insetPlan(base, 3);
  out.push(S(k.slabOf(deck, BED_Z + 3, 9, P, 6, 1), { tone: "mid", inner: seam(deck, BED_Z + 7, 6) }));
  const top = BED_Z + 12;
  out.push(Ln(k.planOutline(k.insetPlan(deck, 4), top, P, 6), { tone: "faint" }));
  out.push(screws(k.corners(deck, 3).map(([x, y]) => [x, y, top]), 0.45));
  const odo = { x: -44, y: 9, w: 40, d: 9, r: 1 };
  out.push(S(k.slabOf(odo, top, 7, P, 3, 0.5), { tone: "mid" }));
  const win = { x: odo.x + 3, y: odo.y + odo.d, z0: top + 1.6, z1: top + 5.6 };
  out.push(box(win.x, win.y - 0.4, win.z0, win.x + 34, win.y + 0.01, win.z1, { tone: "lo" }, { r: 0, steps: 1 }));
  for (let i = 0; i < 5; i++) {
    out.push(faceText("front", [win.x + 2 + i * 6.8, win.y + 0.05, win.z0 + 3.6], "0", 3.4, "hi", "start", ` data-live="odo${i}"`));
  }
  out.push(screws([[odo.x + 1.6, odo.y + odo.d - 1.6, top + 7], [odo.x + odo.w - 1.6, odo.y + odo.d - 1.6, top + 7]], 0.4));
  const dial = [30, 0];
  out.push(S(k.cylinder(dial[0], dial[1], 15, top, 4, P, 64, 0.6), { tone: "hi", crease: "lo" }));
  out.push(Ln(k.knurl(dial[0], dial[1], 15, top + 1, top + 4, 72, P, 0.3), { tone: "lo" }));
  out.push(Ln(k.ring(dial[0], dial[1], 12.6, top + 4, P, 64), { tone: "lo" }));
  const ticks = k.radialTicks(dial[0], dial[1], 12.4, 60, 5, top + 4, [1.2, 2.6], P);
  out.push(Ln(ticks.minor, { tone: "lo" }), Ln(ticks.major, { tone: "mid" }));
  out.push(Ln(k.ring(dial[0], dial[1], 1.4, top + 4, P, 16), { tone: "mid" }));
  out.push(`<path class="iso-line" data-tone="hi" data-free="start" data-live="clock" style="stroke-width:1" d="${k.lineOnTop([dial[0], dial[1] + 2.5], [dial[0], dial[1] - 10.5], top + 4.2, P)}"/>`);
  const quad = [-14, -12];
  out.push(S(k.cylinder(quad[0], quad[1], 9, top, 2.4, P, 48, 0.4), { tone: "mid" }));
  const notches = [];
  for (let i = 0; i <= 4; i++) {
    const a = -Math.PI / 2 - Math.PI * 0.4 + (i * Math.PI * 0.8) / 4;
    notches.push(k.lineOnTop([quad[0] + Math.cos(a) * 6.4, quad[1] + Math.sin(a) * 6.4], [quad[0] + Math.cos(a) * 8.6, quad[1] + Math.sin(a) * 8.6], top + 2.4, P));
  }
  out.push(Ln(notches.join(""), { tone: "mid" }));
  out.push(S(k.cylinder(quad[0] + Math.cos(-Math.PI * 0.1) * 7.6, quad[1] + Math.sin(-Math.PI * 0.1) * 7.6, 1.1, top + 2.4, 2.6, P, 16), { tone: "mid" }));
  out.push(`<path class="iso-line" data-tone="hi" data-free="end" data-live="turns" style="stroke-width:1" d="${k.lineOnTop(quad, [quad[0], quad[1] - 6], top + 2.6, P)}"/>`);
  out.push(Ln(k.ring(quad[0], quad[1], 1.2, top + 2.4, P, 12), { tone: "mid" }));
  const lap = { x: -56, y: -14, w: 22, d: 9, r: 1 };
  out.push(S(k.slabOf(lap, top, 5, P, 3, 0.4), { tone: "mid" }));
  out.push(box(lap.x + 3, lap.y + lap.d - 0.4, top + 1.2, lap.x + 19, lap.y + lap.d + 0.01, top + 4.2, { tone: "lo" }, { r: 0, steps: 1 }));
  out.push(faceText("front", [lap.x + 5, lap.y + lap.d + 0.05, top + 3.9], "L0", 2.6, "hi", "start", ` data-live="laps"`));
  RIG.clock = { x: dial[0], y: dial[1], z: top + 4.2 };
  RIG.quad = { x: quad[0], y: quad[1], z: top + 2.6 };
  const lamp = [52, -18];
  out.push(post(lamp[0], lamp[1], 2.6, top, top + 2, { tone: "mid" }));
  for (const [x, y] of [[-60, 18], [60, 18]]) out.push(post(x, y, 1.6, top, top + 1.2, { tone: "lo" }, 16));
  put("controller", "controller", [0, 0, top - 4], out.join(""), { bias: 0 });
  put("lamp", "controller", [lamp[0], lamp[1], top + 3], S(k.cylinder(lamp[0], lamp[1], 1.9, top + 2, 3, P, 20), { tone: "hi" }), { bias: 1 });

  const cover = [];
  const drum = G.frameAlong([-32, -4, BED_Z + 5], [1, 0, 0]);
  cover.push(S(G.disc(0, 26, 4.2, drum, P, { steps: 40 }), { tone: "hi", inner: k.fadedSvg(G.ribsOf(drum, 0, 26, 4.2, 24, P, { fade: [0.1, 0.55], seams: true }), { tone: "lo" }) }));
  for (const s of [4, 11, 18]) cover.push(S(G.disc(s, s + 2, 5.6, drum, P, { steps: 40 }), { tone: "mid" }));
  cover.unshift(box(-36, -7, BED_Z, -34, -1, BED_Z + 5, { tone: "mid" }, { r: 0.3 }) + box(-4, -7, BED_Z, -2, -1, BED_Z + 5, { tone: "mid" }, { r: 0.3 }));
  put("controller-core", "core", [-19, -4, BED_Z + 3], `<g data-live="ccore" style="opacity:0">${cover.join("")}</g>`, { bias: -40 });
}

function stationBase(plan, z = 0, h = 2.4) {
  return S(k.slabOf(plan, z, h, P, 4, 0.6), { tone: "lo" }) + screws(k.corners(plan, 2.4).map(([x, y]) => [x, y, z + h]), 0.42);
}

function drawerTrim(cab, y, z0, z1) {
  const cx = cab.x + cab.w / 2;
  const holder = { x: cx - 7, z0: z1 - 6.4, z1: z1 - 2.4 };
  const out = [];
  out.push(box(holder.x, y, holder.z0, holder.x + 14, y + 0.5, holder.z1, { tone: "lo" }, { r: 0, steps: 1 }));
  out.push(box(cx - 5, y, z0 + 2.6, cx + 5, y + 2.4, z0 + 4.4, { tone: "hi" }, { r: 0.6 }));
  return out.join("");
}

export function drawerSvg(cab, face, [z0, z1], open) {
  const out = [];
  const x0 = cab.x + 3.4;
  const x1 = cab.x + cab.w - 3.4;
  const yF = face + open;
  if (open > 0.4) {
    out.push(box(x0 + 0.6, face - 0.2, z0 + 0.6, x1 - 0.6, yF, z1 - 1.5, { tone: "lo" }, { r: 0, steps: 1 }));
    const tops = [];
    for (let i = 0; i < 6; i++) {
      const y = yF - 2 - i * 2.6;
      if (y < face + 0.6) break;
      tops.push(k.lineOnTop([x0 + 3, y], [x1 - 3, y], z1 - 2.2, P));
    }
    out.push(Ln(tops.join(""), { tone: "mid" }));
  }
  out.push(box(cab.x + 3, yF, z0, cab.x + cab.w - 3, yF + 1.2, z1, { tone: "mid" }, { r: 0.4 }));
  out.push(drawerTrim(cab, yF + 1.2, z0, z1));
  return out.join("");
}

function model() {
  const x = trackPoint(STOPS.model)[0];
  const hs = { x: x - 32, y: -150, w: 64, d: 56, r: 4 };
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(hs, 0, 4, P)}"/>`);
  out.push(stationBase(k.insetPlan(hs, -5)));
  out.push(S(k.slabOf(k.insetPlan(hs, -1.5), 2.4, 6, P, 6, 0.8), { tone: "mid" }));
  const body = hs;
  out.push(S(k.slabOf(body, 8.4, 52, P, 6, 1.2), { tone: "hi", crease: "lo", inner: seam(body, 22, 6) + seam(body, 46, 6) }));
  const faceY = hs.y + hs.d;
  const finsX = hs.x + hs.w;
  const fins = [];
  for (let i = 0; i < 9; i++) {
    const y = hs.y + 8 + i * 4.6;
    fins.push(box(finsX, y, 14, finsX + 4, y + 1.6, 54, { tone: "mid" }, { r: 0.3, steps: 2 }));
  }
  out.push(fins.join(""));
  const port = G.frameAlong([x, faceY, 34], [0, 1, 0]);
  out.push(S(G.disc(0, 1.6, 15, port, P), { tone: "mid" }));
  out.push(S(G.disc(1.6, 2.4, 11.6, port, P), { tone: "lo" }));
  out.push(Dots(G.dotsOf(port, 1.6, 13.4, 12, P, { all: true }), { size: 0.5, tone: "mid" }));
  out.push(`<path class="iso-line" data-tone="lo" d="${G.circleOf(port, 2.4, 9.4, P)}"/>`);
  out.push(Ln(G.spokesOf(port, 2.4, 2.6, 9.4, 16, P) + G.circleOf(port, 2.4, 2.6, P), { tone: "faint" }));
  const lid = { x: hs.x + 4, y: hs.y + 4, w: hs.w - 8, d: hs.d - 8, r: 3 };
  out.push(S(k.slabOf(lid, 60.4, 3, P, 6, 0.8), { tone: "hi", crease: "lo" }));
  out.push(screws(k.corners(lid, 3).map(([px, py]) => [px, py, 63.4]), 0.5));
  for (const [px, py] of [[x - 14, hs.y + 18], [x + 14, hs.y + 18]]) {
    out.push(rod([px - 5, py, 66.4], "x", 10, 2, { tone: "mid" }));
    out.push(post(px - 4, py, 1.4, 63.4, 66.4, { tone: "mid" }, 12));
    out.push(post(px + 4, py, 1.4, 63.4, 66.4, { tone: "mid" }, 12));
  }
  const ribs = [];
  for (let i = 0; i < 4; i++) ribs.push(k.segment([hs.x + 8 + i * 15, faceY, 8.4], [hs.x + 8 + i * 15, faceY, 22], P));
  out.push(Ln(ribs.join(""), { tone: "faint" }));
  put("model", "model", [x, hs.y + hs.d / 2, 34], out.join(""));

  const armZ = 56;
  const arm = [];
  arm.push(box(x - 5, TRACK.y + 6, armZ, x + 5, faceY - 2, armZ + 6, { tone: "hi" }, { r: 1, bevel: 0.5, inner: seam({ x: x - 5, y: TRACK.y + 6, w: 10, d: faceY - 2 - (TRACK.y + 6), r: 1 }, armZ + 3, 3) }));
  arm.push(screws([[x - 3, TRACK.y + 14, armZ + 6], [x + 3, TRACK.y + 14, armZ + 6], [x - 3, faceY - 8, armZ + 6], [x + 3, faceY - 8, armZ + 6]], 0.45));
  arm.push(box(x - 7, faceY, armZ - 4, x + 7, faceY + 6, armZ + 8, { tone: "mid" }, { r: 1 }));
  arm.push(screws([[x - 5, faceY + 6, armZ + 2], [x + 5, faceY + 6, armZ + 2]], 0.45));
  arm.push(box(x - 6, TRACK.y - 4, armZ - 3, x + 6, TRACK.y + 8, armZ, { tone: "mid" }, { r: 1 }));
  put("model-arm", "model", [x, TRACK.y - 10, armZ + 3], arm.join(""), { bias: 18 });
  put("mhead", "model", [x, TRACK.y, armZ - 6], `<g data-live="mhead">${readHeadSvg(x, TRACK.y, armZ - 3)}</g>`, { bias: 20, live: "mhead" });

  const core = [];
  const drum = G.frameAlong([x - 22, hs.y + 26, 34], [1, 0, 0]);
  core.push(S(G.disc(0, 44, 14, drum, P, { steps: 64 }), { tone: "hi", inner: k.fadedSvg(G.ribsOf(drum, 0, 44, 14, 48, P, { fade: [0.1, 0.55], seams: true }), { tone: "lo" }) + Ln([11, 22, 33].map((s) => G.arcOf(drum, s, 14, P)).join(""), { tone: "faint" }) }));
  for (const px of [x - 27, x + 25]) {
    core.push(box(px, hs.y + 20, 8.4, px + 2, hs.y + 32, 36, { tone: "mid" }, { r: 0.4 }));
    core.push(box(px - 2, hs.y + 18, 8.4, px + 4, hs.y + 34, 10.4, { tone: "lo" }, { r: 0.6 }));
  }
  core.push(S(G.disc(-3, 0, 4, drum, P), { tone: "mid" }));
  core.push(S(G.disc(44, 47, 4, drum, P), { tone: "mid" }));
  put("model-core", "core", [x, hs.y + 26, 30], `<g data-live="mcore" style="opacity:0">${core.join("")}</g>`, { bias: 40 });
  return { x, faceY };
}

export function readHeadSvg(x, y, z) {
  const out = [];
  out.push(box(x - 11, y - 10, z - 5, x + 11, y + 6, z, { tone: "hi" }, { r: 1.4, bevel: 0.5 }));
  out.push(box(x - 12, y - 4, z - 7, x + 12, y + 0, z - 5, { tone: "mid" }, { r: 0.6 }));
  out.push(screws([[x - 8, y + 6, z - 1.5], [x + 8, y + 6, z - 1.5]], 0.45));
  out.push(Dots(k.dotGrid(x - 8, y - 7.5, 8, 6, 2.3, z, P), { size: 0.38, tone: "lo" }));
  return out.join("");
}

function verifier() {
  const y = trackPoint(STOPS.verifier)[1] + TRAY.y + TRAY.d / 2;
  const base = { x: 132, y: y - 26, w: 46, d: 52, r: 3 };
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(base, 0, 4, P)}"/>`);
  out.push(stationBase(k.insetPlan(base, -3)));
  out.push(S(k.slabOf(base, 2.4, 7, P, 4, 1), { tone: "mid", inner: seam(base, 6, 4) }));
  const colX = 152;
  out.push(S(k.cylinder(colX, y + 2, 6, 9.4, 3, P, 32), { tone: "mid" }));
  out.push(post(colX, y + 2, 3.6, 12.4, 64, { tone: "mid", crease: "none" }, 28));
  out.push(Ln([28, 46].map((z) => k.sideArc(colX, y + 2, 3.6, z, P, 16)).join(""), { tone: "faint" }));
  const feeder = { x: 146, y: y - 26, w: 22, d: 16, r: 1.5 };
  out.push(S(k.slabOf(feeder, 9.4, 12, P, 3, 0.6), { tone: "mid" }));
  out.push(Ln(k.planOutline({ x: feeder.x + 4, y: feeder.y + 6, w: 14, d: 2.4, r: 0.4 }, 21.4, P, 2), { tone: "hi" }));
  out.push(screws(k.corners(feeder, 2).map(([px, py]) => [px, py, 21.4]), 0.4));
  const chute = [[feeder.x + 2, feeder.y + 4], [TRACK.x + TRACK.w + 18, feeder.y + 4]];
  out.push(S(k.extrude([[chute[1][0], y - 22], [feeder.x + 2, y - 22], [feeder.x + 2, y - 8], [chute[1][0], y - 8]], 18, 0.8, P), { tone: "lo" }));
  put("verifier", "verifier", [155, y, 20], out.join(""));

  const arm = [];
  arm.push(`<g data-live="varm">`);
  arm.push(box(colX - 6, y - 4, 56, colX + 6, y + 8, 66, { tone: "mid" }, { r: 1.4, bevel: 0.5 }));
  arm.push(box(TRACK.x + TRACK.w - 4, y - 3, 60, colX - 6, y + 3, 64, { tone: "mid" }, { r: 0.8, bevel: 0.4 }));
  const dial = [colX, y + 2];
  const dz = 66;
  arm.push(S(k.cylinder(dial[0], dial[1], 4, dz, 1.6, P, 24), { tone: "mid" }));
  arm.push(S(k.cylinder(dial[0], dial[1], 11, dz + 1.6, 6, P, 64, 0.6), { tone: "hi", crease: "lo" }));
  arm.push(Ln(k.knurl(dial[0], dial[1], 11, dz + 5.2, dz + 7.6, 60, P, 0.3), { tone: "lo" }));
  arm.push(Ln(k.ring(dial[0], dial[1], 9, dz + 7.6, P, 48), { tone: "lo" }));
  const ticks = k.radialTicks(dial[0], dial[1], 8.8, 40, 5, dz + 7.6, [1, 2.2], P, -Math.PI * 0.75, Math.PI * 1.5);
  arm.push(Ln(ticks.minor, { tone: "lo" }), Ln(ticks.major, { tone: "mid" }));
  arm.push(Ln(k.ring(dial[0], dial[1], 1.2, dz + 7.6, P, 12), { tone: "mid" }));
  arm.push(`<path class="iso-line" data-tone="hi" data-free="start" data-live="vneedle" style="stroke-width:1.1" d="${k.lineOnTop(dial, [dial[0], dial[1] - 7.6], dz + 7.8, P)}"/>`);
  arm.push(post(TRACK.x + TRACK.w, y, 2.4, 52, 60, { tone: "mid" }, 18));
  arm.push(`</g>`);
  put("varm", "verifier", [TRACK.x + TRACK.w + 6, y, 62], arm.join(""), { bias: 14, live: "varm" });
  put("plunger", "verifier", [TRACK.x + TRACK.w, y, 40], `<g data-live="plunger">${post(TRACK.x + TRACK.w, y, 1.2, 30, 52, { tone: "hi", crease: "none" }, 14)}${post(TRACK.x + TRACK.w, y, 2.4, 27.6, 30, { tone: "hi" }, 18)}</g>`, { bias: 10, live: "plunger" });
  return { colX, dial, dialZ: 66 + 7.8, y, plungerX: TRACK.x + TRACK.w, feed: [157, y - 15, 21.6], lip: [TRACK.x + TRACK.w + 18, y - 15, 18.8] };
}

function intake() {
  const y = TRACK.y + TRACK.d - TRACK.r - STOPS.intake;
  const out = [];
  const base = { x: -186, y: y - 16, w: 52, d: 34, r: 3 };
  out.push(`<path class="iso-halo" d="${k.haloOf(base, 0, 4, P)}"/>`);
  out.push(stationBase(k.insetPlan(base, -3)));
  out.push(S(k.slabOf(base, 2.4, 6, P, 4, 0.8), { tone: "mid" }));
  const hop = { x: -178, y: y - 9, w: 22, d: 18, r: 1.2 };
  out.push(S(k.slabOf(hop, 8.4, 20, P, 3, 0.6), { tone: "mid", inner: seam(hop, 18, 3) }));
  const stack = [];
  stack.push(k.planOutline(k.insetPlan(hop, 2.2), 28.4, P, 2));
  for (let i = 0; i < 5; i++) stack.push(k.lineOnTop([hop.x + 2.2, hop.y + 3.8 + i * 2.6], [hop.x + hop.w - 2.2, hop.y + 3.8 + i * 2.6], 28.4, P));
  out.push(Ln(stack.join(""), { tone: "mid" }));
  const roll = G.frameAlong([hop.x + hop.w, y - 7, 25], [0, 1, 0]);
  out.push(S(G.disc(0, 14, 3, roll, P), { tone: "hi", inner: k.fadedSvg(G.ribsOf(roll, 0, 14, 3, 16, P, { fade: [0.1, 0.55], seams: true }), { tone: "lo" }) }));
  const chuteRing = [[hop.x + hop.w + 2, y - 6], [TRACK.x - 2, y - 6], [TRACK.x - 2, y + 6], [hop.x + hop.w + 2, y + 6]];
  out.push(S(k.extrude(chuteRing, 22, 0.8, P), { tone: "lo" }));
  out.push(box(hop.x + hop.w + 2, y - 7.4, 22, TRACK.x - 2, y - 6, 24.6, { tone: "mid" }, { r: 0, steps: 1 }));
  out.push(screws([[hop.x + 2, hop.y + 2, 28.4], [hop.x + hop.w - 2, hop.y + hop.d - 2, 28.4]], 0.4));
  put("intake", "intake", [-160, y, 14], out.join(""));
  return { y, from: [hop.x + hop.w / 2, y, 28.4], lip: [TRACK.x - 2, y, 22.8] };
}

function exitUnit() {
  const [ex, ey] = trackPoint(STOPS.exit);
  const out = [];
  const chute = [[ex - 8, ey + 10], [ex + 8, ey + 10], [ex + 8, ey + 40], [ex - 8, ey + 40]];
  out.push(S(k.extrude(chute, 4, 0.8, P), { tone: "lo" }));
  out.push(box(ex - 9.4, ey + 10, 4, ex - 8, ey + 40, 6.4, { tone: "mid" }, { r: 0, steps: 1 }));
  out.push(box(ex + 8, ey + 10, 4, ex + 9.4, ey + 40, 6.4, { tone: "mid" }, { r: 0, steps: 1 }));
  const tray = { x: ex - 16, y: ey + 40, w: 32, d: 30, r: 2 };
  out.push(S(k.slabOf(tray, 0, 2.4, P, 4, 0.6), { tone: "mid" }));
  out.push(S(k.slabOf(k.insetPlan(tray, 2), 2.4, 0.6, P, 4), { tone: "lo", crease: "none" }));
  out.push(box(tray.x, tray.y + tray.d - 2, 2.4, tray.x + tray.w, tray.y + tray.d, 6, { tone: "mid" }, { r: 0.6 }));
  out.push(screws(k.corners(tray, 2).map(([px, py]) => [px, py, 2.4]), 0.4));
  put("exit", "exit", [ex, ey + 40, 3], out.join(""));
  const lx = ex + 15;
  const ly = ey + 14;
  const latch = [];
  latch.push(S(k.cylinder(lx, ly, 4.4, BED_Z, 2, P, 24), { tone: "lo" }));
  latch.push(box(lx - 2.6, ly - 2.6, BED_Z + 2, lx + 2.6, ly + 2.6, 22, { tone: "mid" }, { r: 0.8, bevel: 0.4 }));
  latch.push(screws([[lx - 1.4, ly - 1.4, 22], [lx + 1.4, ly + 1.4, 22]], 0.4));
  put("latch-post", "exit", [lx, ly, 12], latch.join(""));
  put("latch", "exit", [lx - 4, ly - 2, 18], `<g data-live="latch">${box(ex + 3, ly - 1.2, 16.4, lx - 2.6, ly + 1.2, 18.4, { tone: "hi" }, { r: 0.4, steps: 2 })}${box(ex + 3, ly - 6.6, 13.4, ex + 4.6, ly + 1.2, 18.4, { tone: "hi" }, { r: 0.3, steps: 2 })}</g>`, { bias: 1, live: "latch" });
  return { ex, ey };
}

function retrieval() {
  const x = trackPoint(STOPS.retrieval)[0];
  const cab = { x: x - 23, y: -156, w: 46, d: 52, r: 2 };
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(cab, 0, 4, P)}"/>`);
  out.push(stationBase(k.insetPlan(cab, -4)));
  out.push(S(k.slabOf(cab, 2.4, 60, P, 3, 1), { tone: "mid", inner: seam(cab, 30, 3) }));
  out.push(S(k.slabOf(k.insetPlan(cab, -1.2), 62.4, 2, P, 3, 0.6), { tone: "mid" }));
  const face = cab.y + cab.d;
  DRAWERS.forEach(([z0, z1], i) => {
    if (i === 1) return;
    out.push(box(cab.x + 3, face, z0, cab.x + cab.w - 3, face + 1.2, z1, { tone: "mid" }, { r: 0.4 }));
    out.push(drawerTrim(cab, face + 1.2, z0, z1));
  });
  out.push(box(cab.x + 3, face - 0.2, DRAWERS[1][0], cab.x + cab.w - 3, face + 0.01, DRAWERS[1][1], { tone: "lo" }, { r: 0, steps: 1 }));
  put("cabinet", "retrieval", [x, cab.y + cab.d / 2, 30], out.join(""));
  put("drawer", "retrieval", [x, face + 6, 30], `<g data-live="drawer">${drawerSvg(cab, face, DRAWERS[1], 0)}</g>`, { bias: 2 });
  const beamZ = GANTRY_Z;
  put("gantry-r-bracket", "retrieval", [x, cab.y + 12, 68], box(x - 3.4, cab.y + 6, 64.4, x + 3.4, cab.y + 18, beamZ, { tone: "mid" }, { r: 0.6 }) + screws([[x - 1.8, cab.y + 8, beamZ], [x + 1.8, cab.y + 16, beamZ]], 0.4), { bias: 0.5 });
  gantry("r", "retrieval", x, cab.y + 8, TRACK.y + 12, beamZ);
  const lock = [];
  lock.push(box(x - 2.2, face + 1.4, 4, x + 2.2, face + 3.4, 60, { tone: "hi" }, { r: 0.5, bevel: 0.3 }));
  lock.push(box(x - 4, face + 3.4, 26, x + 4, face + 5.4, 33, { tone: "hi" }, { r: 0.8 }));
  lock.push(S(k.cylinder(x, face + 4.4, 1.6, 33, 3, P, 18), { tone: "mid" }));
  put("lockout", "retrieval", [x, face + 4, 30], `<g data-live="lockout" style="opacity:0">${lock.join("")}</g>`, { bias: 3 });
  RIG.retrieval = { x, face, cab, drawers: DRAWERS, open: 20, cardsY: face + 11, cardsZ: DRAWERS[1][1] - 1 };
}

const DRAWERS = [[6, 21], [23, 39], [41, 58]];
const GANTRY_Z = 70;
const GRIP_HOME = 42;

function gantry(tag, asm, x, y0, y1, beamZ) {
  put(`gantry-${tag}-beam`, asm, [x, (y0 + y1) / 2, beamZ + 2], box(x - 2.8, y0, beamZ, x + 2.8, y1 + 4, beamZ + 5, { tone: "mid" }, { r: 0.6, bevel: 0.4 }) + Ln(k.lineOnTop([x, y0 + 2], [x, y1 + 2], beamZ + 5, P), { tone: "faint" }) + screws([[x, y0 + 1.2, beamZ + 5], [x, y1 + 3, beamZ + 5]], 0.4), { bias: 6 });
  const home = TRACK.y;
  put(`${tag}head`, asm, [x, home, beamZ - 4], `<g data-live="${tag}head">${headSvg(x, home, beamZ)}</g>`, { bias: 8, live: `${tag}head` });
  put(`${tag}grip`, asm, [x, home, GRIP_HOME], `<path class="iso-line" data-tone="mid" data-live="${tag}rod" style="stroke-width:1.4" d=""/><g data-live="${tag}grip">${gripSvg(x, home, GRIP_HOME)}</g>`, { bias: 7, live: `${tag}grip` });
}

export function headSvg(x, y, beamZ) {
  const out = [];
  out.push(box(x - 4.6, y - 5, beamZ - 6, x + 4.6, y + 5, beamZ - 0.2, { tone: "hi" }, { r: 0.8, bevel: 0.4 }));
  out.push(box(x - 3.4, y - 3.6, beamZ + 4, x + 3.4, y + 3.6, beamZ + 7, { tone: "mid" }, { r: 0.6 }));
  out.push(box(x - 3.4, y - 3.6, beamZ - 0.2, x - 2.6, y + 3.6, beamZ + 4, { tone: "mid" }, { r: 0, steps: 1 }));
  out.push(box(x + 2.6, y - 3.6, beamZ - 0.2, x + 3.4, y + 3.6, beamZ + 4, { tone: "mid" }, { r: 0, steps: 1 }));
  out.push(screws([[x + 4.6, y - 3, beamZ - 2.4], [x + 4.6, y + 3, beamZ - 2.4]], 0.4));
  out.push(post(x, y, 1.9, beamZ - 8, beamZ - 6, { tone: "mid" }, 16));
  return out.join("");
}

export function gripSvg(x, y, z) {
  const out = [];
  out.push(box(x - 3.8, y - 2, z, x + 3.8, y + 2, z + 2.6, { tone: "hi" }, { r: 0.5 }));
  out.push(box(x - 3.4, y - 0.7, z - 3.4, x - 2.2, y + 0.7, z, { tone: "mid" }, { r: 0.2, steps: 2 }));
  out.push(box(x + 2.2, y - 0.7, z - 3.4, x + 3.4, y + 0.7, z, { tone: "mid" }, { r: 0.2, steps: 2 }));
  return out.join("");
}

function tools() {
  const x = trackPoint(STOPS.tools)[0];
  const bench = { x: x - 32, y: -158, w: 66, d: 60, r: 3 };
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(bench, 0, 4, P)}"/>`);
  out.push(stationBase(k.insetPlan(bench, -3)));
  out.push(S(k.slabOf(bench, 2.4, 8, P, 4, 1), { tone: "mid", inner: seam(bench, 6, 4) }));
  const topZ = 10.4;
  put("toolbench", "tools", [x, bench.y + bench.d / 2, 6], out.join(""), { bias: -6 });

  const calc = { x: x - 20, y: -154, w: 34, d: 30, r: 2.5 };
  const c = [];
  c.push(S(k.slabOf(calc, topZ, 20, P, 4, 1), { tone: "hi", crease: "lo", inner: seam(calc, topZ + 7, 4) }));
  const front = calc.y + calc.d;
  c.push(box(calc.x + 3, front - 0.2, topZ + 10, calc.x + calc.w - 3, front + 0.01, topZ + 17, { tone: "lo" }, { r: 0, steps: 1 }));
  c.push(faceText("front", [calc.x + 5, front + 0.05, topZ + 15.4], "     0", 5, "hi", "start", ` data-live="calc" xml:space="preserve"`));
  const slot = { x: x - 6.4, y: -140, w: 12.8, d: 2.4, r: 0.6 };
  c.push(S(k.slabOf(k.insetPlan(slot, -1.6), topZ + 20, 1.2, P, 3), { tone: "mid" }));
  c.push(Ln(k.planOutline(slot, topZ + 21.2, P, 3), { tone: "hi" }));
  const crank = G.frameAlong([calc.x + calc.w, calc.y + 12, topZ + 11], [1, 0, 0]);
  c.push(S(G.disc(0, 3, 3.6, crank, P), { tone: "mid" }));
  c.push(S(G.disc(3, 5, 2.2, crank, P), { tone: "mid" }));
  c.push(`<path class="iso-line" data-tone="hi" data-live="crank" style="stroke-width:1.6" d=""/>`);
  c.push(screws(k.corners(calc, 2.4).map(([px, py]) => [px, py, topZ + 20]), 0.45));
  put("calculator", "tools", [x - 3, calc.y + calc.d / 2, topZ + 10], c.join(""), { bias: 0 });

  const timer = [x + 24, -146];
  const t = [];
  t.push(post(timer[0], timer[1], 7.4, topZ, topZ + 7, { tone: "hi", crease: "lo" }, 48));
  t.push(Ln(k.ring(timer[0], timer[1], 6, topZ + 7, P, 48), { tone: "lo" }));
  const tt = k.radialTicks(timer[0], timer[1], 5.8, 20, 5, topZ + 7, [0.9, 1.8], P);
  t.push(Ln(tt.minor, { tone: "lo" }), Ln(tt.major, { tone: "mid" }));
  t.push(`<path class="iso-line" data-tone="hi" data-free="start" data-live="timer" style="stroke-width:1" d="${k.lineOnTop(timer, [timer[0], timer[1] - 4.8], topZ + 7.2, P)}"/>`);
  t.push(Ln(k.ring(timer[0], timer[1], 0.9, topZ + 7, P, 10), { tone: "mid" }));
  put("timer", "tools", [timer[0], timer[1], topZ + 4], t.join(""), { bias: 1 });

  const flags = [];
  for (let i = 0; i < 3; i++) {
    const fx = x + 16 + i * 5.4;
    const fy = -128;
    flags.push(post(fx, fy, 1.7, topZ, topZ + 1.4, { tone: "lo" }, 14));
    flags.push(`<g data-live="flag${i}">${post(fx, fy, 0.75, topZ + 1.4, topZ + 8, { tone: "mid" }, 12)}${box(fx - 0.35, fy, topZ + 5, fx + 0.35, fy + 3.6, topZ + 8, { tone: "hi" }, { r: 0, steps: 1 })}</g>`);
  }
  put("retries", "tools", [x + 21, -128, topZ + 4], flags.join(""), { bias: 1 });

  const gauge = { x: x - 10, y: -110, w: 20, d: 9, r: 1 };
  const g = [];
  g.push(S(k.slabOf(gauge, topZ, 12, P, 3, 0.6), { tone: "mid", inner: seam(gauge, topZ + 6, 3) }));
  g.push(box(x - 6.6, gauge.y + 3.2, topZ + 11.8, x + 6.6, gauge.y + 5.8, topZ + 12.01, { tone: "lo" }, { r: 0, steps: 1 }));
  g.push(Ln(k.planOutline({ x: x - 6.8, y: gauge.y + 3, w: 13.6, d: 3, r: 0.3 }, topZ + 12, P, 2), { tone: "hi" }));
  g.push(screws([[gauge.x + 1.4, gauge.y + 1.4, topZ + 12], [gauge.x + gauge.w - 1.4, gauge.y + gauge.d - 1.4, topZ + 12]], 0.4));
  put("schema", "tools", [x, gauge.y + 4.5, topZ + 6], g.join(""), { bias: 2 });

  const permit = { x: x + 10, y: -125, w: 10, d: 9, r: 1 };
  const boltZ = 41.4;
  put("bolt", "tools", [x + 3, permit.y + 4.5, boltZ], `<g data-live="bolt">${rod([x - 7, permit.y + 4.5, boltZ], "x", 17.4, 1.5, { tone: "hi" })}${S(G.disc(-1.2, 0, 2.2, G.frameAlong([x - 7, permit.y + 4.5, boltZ], [1, 0, 0]), P), { tone: "hi" })}</g>`, { bias: -0.5 });
  const p = [];
  p.push(S(k.slabOf(permit, topZ, 32, P, 3, 0.6), { tone: "mid", inner: seam(permit, topZ + 12, 3) }));
  p.push(S(k.slabOf(k.insetPlan(permit, -0.8), topZ + 32, 2, P, 3, 0.4), { tone: "mid" }));
  p.push(S(G.disc(-0.8, 0, 2.6, G.frameAlong([permit.x, permit.y + 4.5, boltZ], [1, 0, 0]), P), { tone: "mid" }));
  const key = G.frameAlong([permit.x + permit.w, permit.y + 4.5, topZ + 20], [1, 0, 0]);
  p.push(S(G.disc(0, 1.6, 2.2, key, P), { tone: "mid" }));
  p.push(`<g data-live="key">${box(permit.x + permit.w + 1.6, permit.y + 4, topZ + 18, permit.x + permit.w + 2.4, permit.y + 5, topZ + 22, { tone: "hi" }, { r: 0, steps: 1 })}</g>`);
  p.push(screws([[permit.x + 1.4, permit.y + 1.4, topZ + 34], [permit.x + permit.w - 1.4, permit.y + permit.d - 1.4, topZ + 34]], 0.4));
  put("permit", "tools", [permit.x + 5, permit.y + 4.5, topZ + 16], p.join(""), { bias: 2 });

  put("gantry-t-bracket", "tools", [x, -158, 40], S(k.cylinder(x, -160, 4.2, 0, 2, P, 24), { tone: "lo" }) + post(x, -160, 2.3, 2, GANTRY_Z, { tone: "mid", crease: "none" }), { bias: -8 });
  gantry("t", "tools", x, -162, TRACK.y + 12, GANTRY_Z);
  RIG.tools = { x, gaugeY: gauge.y + 4.5, gaugeZ: topZ + 12, boltY: permit.y + 4.5, boltZ, slotY: -138.8, slotZ: topZ + 21.2, timer, crank: [calc.x + calc.w + 5, calc.y + 12, topZ + 11], flagsZ: topZ };
}

function memory() {
  const y = trackPoint(STOPS.memory)[1];
  const out = [];
  const base = { x: -192, y: y - 18, w: 58, d: 30, r: 3 };
  out.push(`<path class="iso-halo" d="${k.haloOf(base, 0, 4, P)}"/>`);
  out.push(stationBase(k.insetPlan(base, -2)));
  for (const px of [-186, -164]) out.push(box(px, y - 14, 2.4, px + 2.4, y - 8, 44, { tone: "mid" }, { r: 0.4 }));
  out.push(box(-187, y - 12.6, 34, -160.6, y - 8.6, 44.4, { tone: "mid" }, { r: 0.4, bevel: 0.3 }));
  const drum = G.frameAlong([-183.6, y - 11, 24], [1, 0, 0]);
  out.push(S(G.disc(-1.2, 0, 9.4, drum, P), { tone: "mid" }));
  out.push(S(G.disc(0, 19.6, 8, drum, P, { steps: 56 }), { tone: "hi", inner: k.fadedSvg(G.ribsOf(drum, 0, 19.6, 8, 36, P, { fade: [0.1, 0.55], seams: true }), { tone: "lo" }) }));
  out.push(S(G.disc(19.6, 20.8, 9.4, drum, P), { tone: "mid" }));
  const copier = { x: -160, y: y - 7, w: 22, d: 14, r: 1.2 };
  const cz = 26;
  out.push(S(k.slabOf(copier, 2.4, cz - 2.4, P, 3, 0.6), { tone: "mid", inner: seam(copier, 12, 3) }));
  out.push(Ln(k.planOutline({ x: copier.x + 4, y: copier.y + 5.8, w: 14, d: 2.4, r: 0.4 }, cz, P, 2), { tone: "hi" }));
  out.push(S(k.extrude([[copier.x + copier.w, y - 7], [TRACK.x - 3, y - 7], [TRACK.x - 3, y + 7], [copier.x + copier.w, y + 7]], cz - 2, 0.8, P), { tone: "lo" }));
  out.push(box(copier.x + copier.w, y + 7, cz - 2, TRACK.x - 3, y + 8.2, cz + 0.2, { tone: "mid" }, { r: 0, steps: 1 }));
  out.push(screws([[copier.x + 2, copier.y + 2, cz], [copier.x + copier.w - 2, copier.y + copier.d - 2, cz]], 0.4));
  put("memory", "memory", [-165, y, 16], out.join(""));
  RIG.memory = { from: [copier.x + 11, y, cz - 1.2], lip: [TRACK.x - 3, y, cz - 1.2] };
}

function printer() {
  const px = 128;
  const py = 84;
  const body = { x: px - 20, y: py - 10, w: 40, d: 20, r: 3 };
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(body, 0, 4, P)}"/>`);
  out.push(stationBase(k.insetPlan(body, -3)));
  out.push(S(k.slabOf(body, 2.4, 14, P, 4, 1), { tone: "mid", inner: seam(body, 10, 4) }));
  for (const sx of [px - 15, px + 13.6]) out.push(box(sx, py - 6, 16.4, sx + 1.4, py + 2, 27, { tone: "mid" }, { r: 0.4 }));
  const roll = G.frameAlong([px - 13.6, py - 2, 22.6], [1, 0, 0]);
  out.push(S(G.disc(0, 27.2, 5, roll, P), { tone: "hi", inner: Ln(G.arcOf(roll, 2, 5, P) + G.arcOf(roll, 25.2, 5, P), { tone: "faint" }) }));
  out.push(box(px - 13, py + 9.8, 11, px + 13, py + 10.4, 15, { tone: "lo" }, { r: 0, steps: 1 }));
  out.push(screws(k.corners(body, 2.2).map(([x, y]) => [x, y, 16.4]), 0.42));
  put("printer", "printer", [px, py, 10], out.join(""));
  const t0 = py + 10.4;
  const t1 = PLATE.y + PLATE.d - 1.5;
  const tape = [];
  tape.push(S(k.extrude([[px - 11, t0], [px + 11, t0], [px + 11, t1], [px - 11, t1]], 0, 0.3, P), { tone: "lo", crease: "none" }));
  tape.push(`<g data-live="tape"></g>`);
  put("tape", "printer", [px, (t0 + t1) / 2, 0.2], tape.join(""), { bias: -20 });
  RIG.printer = { px, t0, t1, x0: px - 9.4 };
}

export function cardSvg(i, { lit = false } = {}) {
  const { y, z } = slotOf(i);
  const out = [];
  const t = RACK.t;
  const face = y + t;
  out.push(S(k.slabOf({ x: RACK.x, y, w: RACK.w, d: t, r: 0 }, z, RACK.h, P, 1), { tone: lit ? "hi" : "mid", lit }));
  const tabs = { request: 0, memory: 3.6, doc: 7.2, result: 10.8, "tool-error": 10.8, feedback: 14.4 };
  for (const [name, offset] of Object.entries(tabs)) {
    out.push(`<g data-tab="${name}" style="display:none">${S(k.slabOf({ x: RACK.x + offset, y, w: 3, d: t, r: 0 }, z + RACK.h, 1.6, P, 1), { tone: "hi" })}</g>`);
  }
  out.push(Ln(k.segment([RACK.x + 1.6, face, z + RACK.h - 2.6], [RACK.x + 13, face, z + RACK.h - 2.6], P) + k.segment([RACK.x + 1.6, face, z + RACK.h - 4.6], [RACK.x + 9, face, z + RACK.h - 4.6], P), { tone: "faint", free: true }));
  return out.join("");
}

export function slipSvg() {
  const x = 0;
  const y = TRAY.y + TRAY.d / 2;
  const z = TRAY.z;
  const out = [];
  out.push(S(k.slabOf({ x: x - 6, y: y - 2.6, w: 12, d: 5.2, r: 0.3 }, z, 0.5, P, 1), { tone: "hi" }));
  out.push(Ln(k.lineOnTop([x - 3.6, y - 0.8], [x + 2.6, y - 0.8], z + 0.5, P) + k.lineOnTop([x - 3.6, y + 0.8], [x + 1, y + 0.8], z + 0.5, P), { tone: "lo", free: true }));
  out.push(`<g data-stamp style="display:none">${Ln(k.ring(x + 3.2, y + 1, 0.8, z + 0.5, P, 12), { tone: "hi" })}</g>`);
  return out.join("");
}

function carriage() {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf({ x: -16, y: -16, w: 32, d: 32, r: 16 }, PUCK.z, 0.1, P)}" style="filter:blur(3px);opacity:.4"/>`);
  out.push(S(k.cylinder(0, 0, PUCK.r, PUCK.z, PUCK.h, P, 56, 0.6), { tone: "mid", inner: Ln(k.sideArc(0, 0, PUCK.r, PUCK.z + 1.6, P, 40), { tone: "faint" }) }));
  out.push(Ln(k.ring(0, 0, PUCK.r - 2.2, PUCK.z + PUCK.h, P, 48), { tone: "faint" }));
  out.push(screws([0, 1, 2, 3, 4, 5].map((i) => [Math.cos((i * Math.PI) / 3 + 0.5) * (PUCK.r - 1.1), Math.sin((i * Math.PI) / 3 + 0.5) * (PUCK.r - 1.1), PUCK.z + PUCK.h]), 0.4));
  for (let i = 0; i < RACK.slots; i++) {
    const { y, z } = slotOf(i);
    const top = i === RACK.slots - 1 ? RACK.pitch + 0.6 : RACK.pitch;
    out.push(S(k.slabOf({ x: RACK.x - 0.8, y: y - 0.3, w: RACK.w + 1.6, d: top, r: 0 }, PUCK.z + PUCK.h, z - PUCK.z - PUCK.h, P, 1), { tone: "mid", crease: "lo" }));
  }
  for (const sx of [RACK.x - 1.6, RACK.x + RACK.w + 0.8]) {
    out.push(S(k.slabOf({ x: sx, y: RACK.y0 - 0.6, w: 0.8, d: RACK.pitch * RACK.slots + 0.6, r: 0 }, PUCK.z + PUCK.h, 3.4, P, 1), { tone: "mid" }));
  }
  const sign = { y: RACK.y0 - 1.8, z0: PUCK.z + PUCK.h, z1: 42 };
  out.push(box(-11, sign.y, sign.z0, 11, sign.y + 0.8, sign.z1, { tone: "mid" }, { r: 0.3, steps: 2 }));
  out.push(screws([[-9.8, sign.y + 0.8, 40], [9.8, sign.y + 0.8, 40]], 0.4));
  out.push(faceText("front", [0, sign.y + 0.85, baseline(36, 42, 4.4)], CONCEPT.carriage, 4.4, "hi", "middle"));
  out.push(S(k.slabOf({ x: TRAY.x, y: TRAY.y, w: TRAY.w, d: TRAY.d, r: 0.5 }, PUCK.z + PUCK.h, 0.01, P, 2), { tone: "lo", crease: "none" }));
  out.push(box(TRAY.x - 0.6, TRAY.y + TRAY.d, PUCK.z + PUCK.h, TRAY.x + TRAY.w + 0.6, TRAY.y + TRAY.d + 0.9, PUCK.z + PUCK.h + 1.4, { tone: "mid" }, { r: 0.3, steps: 2 }));
  return out.join("");
}

export const RIG = {};

const plateWidth = (text, size) => text.length * size * 0.62 + size * 1.8;
const baseline = (z0, z1, size) => (z0 + z1) / 2 - size * 0.36;
function plateFront(asm, cx, y, z0, z1, text, size) {
  const w = plateWidth(text, size);
  const svg = box(cx - w / 2, y, z0, cx + w / 2, y + 0.7, z1, { tone: "mid" }, { r: 0.3, steps: 2 })
    + screws([[cx - w / 2 + 1.2, y + 0.7, (z0 + z1) / 2], [cx + w / 2 - 1.2, y + 0.7, (z0 + z1) / 2]], 0.4)
    + faceText("front", [cx, y + 0.75, baseline(z0, z1, size)], text, size, "hi", "middle");
  put(`tag-${asm}`, asm, [cx, y + 1, (z0 + z1) / 2], svg, { bias: 1.5 });
}
function plateSide(asm, x, cy, z0, z1, text, size) {
  const w = plateWidth(text, size);
  const svg = box(x, cy - w / 2, z0, x + 0.7, cy + w / 2, z1, { tone: "mid" }, { r: 0.3, steps: 2 })
    + screws([[x + 0.7, cy - w / 2 + 1.2, (z0 + z1) / 2], [x + 0.7, cy + w / 2 - 1.2, (z0 + z1) / 2]], 0.4)
    + faceText("side", [x + 0.75, cy, baseline(z0, z1, size)], text, size, "hi", "middle");
  put(`tag-${asm}`, asm, [x + 1, cy, (z0 + z1) / 2], svg, { bias: 1.5 });
}
function standingTag(asm, cx, y, text, size) {
  const w = plateWidth(text, size);
  const svg = box(cx - w / 2 - 1, y - 2.4, 0, cx + w / 2 + 1, y + 1, 1.2, { tone: "lo" }, { r: 0.6, steps: 2 })
    + box(cx - w / 2, y - 1.6, 1.2, cx + w / 2, y, 11, { tone: "mid" }, { r: 0.4, steps: 2, bevel: 0.3 })
    + faceText("front", [cx, y + 0.05, baseline(1.2, 11, size)], text, size, "hi", "middle");
  put(`tag-${asm}`, asm, [cx, y, 6], svg, { bias: 1.5 });
}
function nameplates() {
  const iy = trackPoint(STOPS.intake)[1];
  standingTag("intake", -160, iy + 26, CONCEPT.intake, 5.6);
  const my = trackPoint(STOPS.memory)[1];
  plateFront("memory", -173.8, my - 8.6, 35, 43.4, CONCEPT.memory, 5);
  plateSide("retrieval", RIG.retrieval.cab.x + RIG.retrieval.cab.w, RIG.retrieval.cab.y + RIG.retrieval.cab.d / 2, 43, 53, CONCEPT.retrieval, 6);
  const mx = RIG.model.x;
  const sy = RIG.model.faceY - 9;
  put("model-sign-feet", "model", [mx, sy - 1, 64], box(mx - 13, sy - 2.4, 63.4, mx - 10, sy + 0.4, 66, { tone: "mid" }, { r: 0.3 }) + box(mx + 10, sy - 2.4, 63.4, mx + 13, sy + 0.4, 66, { tone: "mid" }, { r: 0.3 }), { bias: 1 });
  const w = plateWidth(CONCEPT.model, 7);
  put("tag-model", "model", [mx, sy, 70], box(mx - w / 2, sy - 1.2, 66, mx + w / 2, sy, 76, { tone: "mid" }, { r: 0.4, steps: 2, bevel: 0.3 }) + faceText("front", [mx, sy + 0.05, baseline(66, 76, 7)], CONCEPT.model, 7, "hi", "middle"), { bias: 1.5 });
  plateFront("tools", RIG.tools.x + 20, -98, 3.4, 9.8, CONCEPT.tools, 5.2);
  const vy = RIG.verifier.y;
  plateFront("verifier", 155, vy + 26, 3.2, 9, CONCEPT.verifier, 4.8);
  plateFront("printer", RIG.printer.px, 84 + 10, 3.4, 9.8, CONCEPT.printer, 5.2);
  plateFront("controller", -12, 23, 7, 14, CONCEPT.controller, 5.2);
  const { ex, ey } = RIG.exit;
  put("tag-exit", "exit", [ex, ey + 46, 3], faceText("top", [ex, ey + 47, 3], CONCEPT.exit, 6, "hi", "middle"), { bias: 0.5 });
}

export function build() {
  items.length = 0;
  basePlate();
  trackBed();
  controller();
  retrieval();
  RIG.model = model();
  tools();
  RIG.verifier = verifier();
  RIG.intake = intake();
  memory();
  RIG.exit = exitUnit();
  printer();
  nameplates();
  put("carriage", "carriage", [0, 0, 8], `<g data-live="carriage">${carriage()}</g>`, { live: "carriage", bias: -20 });
  for (let i = 0; i < RACK.slots; i++) {
    const { y, z } = slotOf(i);
    put(`card${i}`, "carriage", [0, y, z + RACK.h / 2], `<g data-live="card${i}" style="display:none">${cardSvg(i)}</g>`, { live: `card${i}`, bias: 0.01 * i });
  }
  put("slip", "carriage", [0, TRAY.y + TRAY.d / 2, TRAY.z + 0.4], `<g data-live="slip" style="display:none">${slipSvg()}</g>`, { live: "slip", bias: 0.5 });
  RIG.gripHome = GRIP_HOME;
  RIG.gantryZ = GANTRY_Z;
  return RIG;
}
