import * as k from "../agent-machine/kit/iso-kit.mjs";
import * as ink from "../agent-machine/kit/ink.mjs";

export const W = 1000;
export const H = 440;
export const AZIMUTH = 72;

export const PLATE = { x: -250, y: -82, w: 500, d: 132, r: 8 };
export const PLATE_H = 8;
export const FOOT_H = 4;
export const RAIL = { x0: -240, x1: 240, y0: 22, y1: 30, z: 1.6 };
export const RAIL_Y = 26;
export const STATIONS = ["header", "sections", "disasm", "cfg", "lift", "types", "structure", "pseudocode", "ledger"];
export const XS = Object.fromEntries(STATIONS.map((asm, i) => [asm, -208 + i * 52]));
export const HOME_X = -240 + 12;
export const SLED = { w: 20, y0: 20, y1: 32, z0: RAIL.z, z1: RAIL.z + 3 };
export const STACK = { z0: SLED.z1, step: 0.9, t: 0.7, slots: 9 };
export const HEAD = { home: 18, h: 3.2, armZ: 25, armTop: 27.4 };
export const BED = { half: 16, y0: -60, y1: -48, z: 10.2 };
export const CHIP = { half: 11, y0: -43, y1: -23, z0: 3.4, z1: 7.4 };
export const LANES = { count: 16, x0: -9.6, w: 1.2, y0: -41.4, y1: -29.4 };
export const CAB = { half: 17, y0: -60, y1: -18, z0: 2.4, z1: 42 };
export const CARD = { half: 14.5, y0: -41.4, y1: -40, z0: 6, z1: 37 };
export const SLOTS = { front: { y0: -33, y1: -21, z: 12, face: -16, label: 5.2 }, back: { y0: -55, y1: -43, z: 17, face: -38, label: 13.5 } };
export const BOARD = { y0: -62, y1: -12, z: 9 };
export const IR = { y0: -46, y1: -30, z: 20, t: 0.62, gap: 0.08 };
export const PINS = { z: 15, rise: 5, r: 1.5, slots: 8 };
export const SHEET = { y: -35.4, t: 0.6, z: 24.4, line: 1.5, half: 10 };
export const TRAYS = { y0: -50, y1: -30, z: 18.8, t: 0.7, step: 0.85, slots: 10, kinds: ["observed", "derived", "inferred", "unknown"] };

export const stackTop = (n) => STACK.z0 + n * STACK.step;

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [-250, -84, 78], [250, -84, 58], [250, 56, 14]],
  W,
  H,
  { pad: 8, azimuth: AZIMUTH },
);
export const V = [k.depthOf([1, 0, 0], P), k.depthOf([0, 1, 0], P), k.depthOf([0, 0, 1], P)];
export const at = (p) => k.iso(p, P);
export const depth = (p) => p[0] * V[0] + p[1] * V[1] + p[2] * V[2];

export const S = (paths, style = {}) => ink.inkSolid(paths, style);
export const Ln = (d, style) => k.lineSvg(d, style);
export const Dots = (points, style) => k.dotsSvg(points, style);
export const box = (x0, y0, z0, x1, y1, z1, style = {}, { r = 0.6, steps = 3, bevel = 0, inner = "" } = {}) =>
  S(k.slabOf({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: Math.min(r, (x1 - x0) / 2.2, (y1 - y0) / 2.2) }, z0, z1 - z0, P, r ? steps : 1, bevel), { tone: "mid", ...style, inner });
export const post = (x, y, r, z0, z1, style = {}, steps = 24) => S(k.cylinder(x, y, r, z0, z1 - z0, P, steps), { tone: "mid", ...style });
export const screws = (points, size = 0.42, tone = "mid") => Dots(points.map(at), { size, tone });
export const seam = (plan, z, steps = 3) => Ln(k.sideSeam(plan, z, P, steps), { tone: "faint" });
export const plan = (x0, y0, x1, y1, r = 0.6) => ({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r });

export const frontText = (x, y, z, text, size, anchor = "middle") => k.faceTextSvg(k.sideMatrix([x, y + 0.06], z, P, "left"), text, { size, tone: "hi", anchor });
export const topText = (x, y, z, text, size) => k.faceTextSvg(k.topMatrix([x, y], z + 0.02, P, "x"), text, { size, tone: "hi", anchor: "middle" });

export function drawersSvg(sections) {
  const x = XS.sections;
  const top = CAB.z1 - 1.2;
  const pitch = (top - (CAB.z0 + 7)) / sections.length;
  const size = Math.min(3, pitch * 0.66);
  const fronts = sections.map((section, i) => {
    const z1 = top - i * pitch;
    const z0 = z1 - pitch + 0.3;
    const mid = (z0 + z1) / 2;
    const isText = section.name === ".text";
    const tray = isText ? `<g data-tray style="display:none">${box(x - 14, CAB.y1 - 9, z0 + 0.2, x + 14, CAB.y1, z1 - 0.4, { tone: "lo" }, { r: 0, steps: 1 })}</g>` : "";
    const svg = `<g data-drawer="${i}" data-name="${section.name}">${tray}${box(x - 15.4, CAB.y1, z0, x + 15.4, CAB.y1 + 1.1, z1, { tone: "hi", material: isText ? "ride" : "hi" }, { r: 0.2, steps: 2 })}${frontText(x - 14.2, CAB.y1 + 1.1, mid - size * 0.36, section.name, size, "start")}${box(x + 10, CAB.y1 + 1.1, mid - pitch * 0.18, x + 14, CAB.y1 + 1.7, mid + pitch * 0.18, { tone: "lo" }, { r: 0, steps: 1 })}</g>`;
    return [isText, svg];
  });
  return fronts.filter(([isText]) => !isText).map(([, svg]) => svg).join("") + fronts.filter(([isText]) => isText).map(([, svg]) => svg).join("");
}

export function lanesSvg(states) {
  const x = XS.disasm;
  const material = { a: "ride", b: "hi", x: "lo", wait: "board", gap: "chip" };
  return states
    .map((state, i) => {
      if (state === "none") return "";
      const x0 = x + LANES.x0 + i * LANES.w + 0.12;
      return box(x0, LANES.y0, CHIP.z1, x0 + LANES.w - 0.24, LANES.y1, CHIP.z1 + (state === "gap" ? 0.08 : 0.5), { tone: "hi", material: material[state] }, { r: 0, steps: 1 });
    })
    .join("");
}

export function slotList(lift) {
  if (!lift || lift.error) return [];
  const regs = lift.params.map((param) => ({ row: "front", label: param.register.toUpperCase(), name: param.name }));
  const stack = lift.locals.map((local) => ({ row: "back", label: "RBP-" + local.name.split("_")[1].toUpperCase(), name: local.name }));
  return [...regs, ...stack, { row: "front", label: "RAX", name: "return" }];
}

export function slotsSvg(slots) {
  const x = XS.types;
  const out = [];
  const tokens = [];
  for (const row of ["front", "back"]) {
    const list = slots.map((slot, i) => [slot, i]).filter(([slot]) => slot.row === row);
    const geo = SLOTS[row];
    if (!list.length && row === "back") out.push(frontText(x, geo.face, geo.label, slots.length ? "NO STACK SLOTS" : "", 2.6));
    const width = 30 / Math.max(3, list.length);
    list.forEach(([slot, i], j) => {
      const x0 = x - 15 + j * width + 0.8;
      const x1 = x0 + width - 1.6;
      out.push(box(x0, geo.y0, geo.z - 0.4, x1, geo.y1, geo.z + 0.04, { tone: "lo", material: "chip" }, { r: 0, steps: 1 }));
      out.push(row === "front" ? topText((x0 + x1) / 2, -17.6, geo.z, slot.label, 2.4) : frontText((x0 + x1) / 2, geo.face, geo.label, slot.label, slot.label.length > 4 ? 2.5 : 3.2));
      tokens.push([i, `<g data-pin="${i}" style="display:none">${box(x0 + 0.8, geo.y0 + 1.6, geo.z, x1 - 0.8, geo.y1 - 1.6, geo.z + 3, { tone: "hi", material: "ride" }, { r: 0.4, steps: 2 })}</g>`]);
    });
  }
  return out.join("") + tokens.sort((a, b) => a[0] - b[0]).map(([, svg]) => svg).join("");
}

export function sheetSvg(lines, printed) {
  const x = XS.pseudocode;
  if (!printed) return "";
  const height = printed * SHEET.line + 1.6;
  const z1 = SHEET.z + height;
  const out = [box(x - SHEET.half, SHEET.y, SHEET.z, x + SHEET.half, SHEET.y + SHEET.t, z1, { tone: "hi" }, { r: 0, steps: 1 })];
  const face = SHEET.y + SHEET.t;
  const strokes = [];
  for (let i = 0; i < printed; i++) {
    const line = lines[i];
    const indent = line.length - line.trimStart().length;
    const length = line.trim().length;
    if (!length) continue;
    const x0 = x - SHEET.half + 1.4 + indent * 0.32;
    const x1 = Math.min(x + SHEET.half - 1.2, x0 + length * 0.36);
    const z = z1 - 1.2 - i * SHEET.line;
    strokes.push(k.segment([x0, face, z], [x1, face, z], P));
  }
  out.push(Ln(strokes.join(""), { tone: "mid" }));
  return out.join("");
}

export function tilesSvg(variant) {
  const x = XS.disasm;
  const [start, end] = variant.range;
  const span = end - start;
  const reached = new Set(variant.reached);
  const scale = (BED.half * 2) / span;
  const out = [];
  variant.insns.forEach((insn, i) => {
    const x0 = x - BED.half + (insn.a - start) * scale;
    const x1 = x0 + insn.n * scale;
    const gap = Math.min(0.12, (x1 - x0) * 0.2);
    const hot = reached.has(insn.a);
    const h = hot ? 1.6 : 0.7;
    out.push([x0, `<g data-tile="${i}" data-addr="${insn.a}" style="display:none">${box(x0 + gap, BED.y0 + 2, BED.z, x1 - gap, BED.y1 - 2, BED.z + h, { tone: hot ? "hi" : "lo" }, { r: 0, steps: 1 })}</g>`]);
  });
  const marks = [];
  for (const a of variant.missed) {
    const insn = variant.descentInsns.find((item) => item.a === a);
    const x0 = x - BED.half + (insn.a - start) * scale;
    const x1 = x0 + insn.n * scale;
    marks.push(`<g data-missed style="display:none">${Ln(k.planOutline(plan(x0 + 0.1, BED.y0 + 1.4, x1 - 0.1, BED.y1 - 1.4, 0), BED.z, P, 1), { tone: "mid", dotted: true })}</g>`);
  }
  if (variant.conflict) {
    const px = x - BED.half + (variant.conflict.target - start) * scale;
    marks.push(`<g data-conflict style="display:none">${post(px, BED.y1 - 3.4, 0.7, BED.z, BED.z + 5.4, { tone: "hi" }, 12)}${S(k.cylinder(px, BED.y1 - 3.4, 1.3, BED.z + 5.4, 0.8, P, 14), { tone: "hi" })}</g>`);
  }
  return out.map(([, svg]) => svg).join("") + marks.join("");
}

export function cursorX(variant, address) {
  const [start, end] = variant.range;
  return XS.disasm - BED.half + ((address - start) / (end - start)) * BED.half * 2;
}

export function graphLayout(variant) {
  const x = XS.cfg;
  const live = variant.blocks.filter((block) => block.live);
  const layers = {};
  for (const block of live) (layers[block.layer] = layers[block.layer] || []).push(block);
  const pos = {};
  for (const [layer, list] of Object.entries(layers)) {
    list.forEach((block, j) => {
      pos[block.s] = [x - 6 + (j - (list.length - 1) / 2) * 11, BOARD.y0 + 8 + Number(layer) * 10];
    });
  }
  return pos;
}

export function graphSvg(variant) {
  const x = XS.cfg;
  const pos = graphLayout(variant);
  const live = variant.blocks.filter((block) => block.live);
  const dead = variant.blocks.filter((block) => !block.live);
  const kept = variant.edges.filter((edge) => pos[edge.f] && pos[edge.t]);
  const routed = kept.filter((edge) => edge.f !== edge.t);
  const edges = routed
    .map((edge, i) => {
      const [fx, fy] = pos[edge.f];
      const [tx, ty] = pos[edge.t];
      const lane = (fy + ty) / 2 + (i % 2 ? 1.2 : -1.2);
      return k.onTop([[fx, fy], [fx, lane], [tx, lane], [tx, ty]], BOARD.z + 0.05, P);
    })
    .join("");
  const count = `${live.length} BLOCK${live.length === 1 ? "" : "S"} · ${kept.length} EDGE${kept.length === 1 ? "" : "S"}`;
  const out = [`<g data-count style="display:none">${topText(x, BOARD.y0 + 1.6, BOARD.z, count, 2.6)}</g>`, `<g data-edges style="display:none">${Ln(edges, { tone: "hi" })}</g>`];
  const cubes = live
    .map((block) => [pos[block.s], block])
    .sort((a, b) => depth([a[0][0], a[0][1], 0]) - depth([b[0][0], b[0][1], 0]))
    .map(([[bx, by], block]) => {
      const h = 2.2 + Math.min(block.n, 8) * 0.45;
      return `<g data-block="${block.s}" style="display:none">${box(bx - 3.2, by - 2.6, BOARD.z, bx + 3.2, by + 2.6, BOARD.z + h, { tone: "hi" }, { r: 0.5, bevel: 0.3 })}</g>`;
    });
  out.push(...cubes);
  const row = dead.map((block, i) => {
    const bx = x - 17 + i * 2;
    return box(bx, -17, BOARD.z, bx + 1.5, -14.4, BOARD.z + 1.6, { tone: "lo" }, { r: 0, steps: 1 });
  });
  out.push(`<g data-dead style="display:none">${row.join("")}</g>`);
  return out.join("");
}

export function binSvg(count) {
  const x = XS.cfg;
  const out = [];
  for (let i = 0; i < count; i++) {
    const z = BOARD.z + 0.6 + i * 0.5;
    out.push(box(x + 11.4, -30.4, z, x + 16.6, -20.6, z + 0.4, { tone: "lo" }, { r: 0, steps: 1 }));
  }
  return out.join("");
}

export function irSvg(count) {
  const x = XS.lift;
  const out = [];
  for (let i = 0; i < count; i++) {
    const z = IR.z + 0.6 + i * (IR.t + IR.gap);
    out.push(`<g data-ir="${i}" style="display:none">${box(x - 9, IR.y0, z, x + 9, IR.y1, z + IR.t, { tone: "hi", material: i % 2 ? "hi" : "ride" }, { r: 0.4, steps: 2 })}</g>`);
  }
  return out.join("");
}


export const castShadowSvg = (points, z0 = 0) => ink.castShadowSvg(points, P, z0);
export const glassSvg = (x0, y0, z0, x1, y1, z1) => ink.glassSvg(x0, y0, z0, x1, y1, z1, P);
export const silhouetteSvg = (points) => ink.silhouetteSvg(points, P);
export const pillSvg = ink.pillSvg;

export function cursorSvg(cx) {
  const y0 = BED.y0 - 1.6;
  const y1 = BED.y1 + 1.6;
  const z = BED.z + 3.4;
  return box(cx - 1.2, y0, BED.z - 0.6, cx + 1.2, y0 + 1.4, z, { tone: "hi" }, { r: 0.3 })
    + box(cx - 1.2, y1 - 1.4, BED.z - 0.6, cx + 1.2, y1, z, { tone: "hi" }, { r: 0.3 })
    + box(cx - 1.4, y0, z, cx + 1.4, y1, z + 1.6, { tone: "hi" }, { r: 0.4, bevel: 0.3 })
    + box(cx - 0.45, (y0 + y1) / 2 - 0.7, BED.z + 2.2, cx + 0.45, (y0 + y1) / 2 + 0.7, z, { tone: "hi" }, { r: 0, steps: 1 });
}
