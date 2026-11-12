'use strict';

const { ISO, color } = require('./figkit.js');
const marks = require('./marks.js');

const NEUTRAL = ['paper', 'panel', 'ink', 'ink-mute', 'ink-soft'];
const r1 = value => Math.round(value * 10) / 10;
const inkOf = hue => color(NEUTRAL.includes(hue) ? hue : `${hue}-ink`);
const fillOf = hue => color(NEUTRAL.includes(hue) ? hue : `${hue}-fill`);

function snap(view) {
  return { ...view, P: (x, y, z = 0) => view.P(x, y, z).map(r1) };
}

function isoView(f, options) {
  return snap(f.isoView(options));
}

function quad(f, view, points, options) {
  f.polygon(points.map(point => view.P(...point)), options);
}

function edge(f, view, points, hue, width = 0.8, dash) {
  stroke(f, points.map(point => view.P(...point)), hue, width, dash);
}

function tint(f, view, points, hue, opacity) {
  quad(f, view, points, { fill: inkOf(hue), fillOpacity: opacity });
}

function ellipse(cx, cy, rx, ry, from, to, steps) {
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = from + ((to - from) * i) / steps;
    points.push([r1(cx + rx * Math.cos(a)), r1(cy + ry * Math.sin(a))]);
  }
  return points;
}

function pick(option, defaults) {
  if (!option) return null;
  const given = typeof option === 'string' || option.onFace ? { id: option } : option;
  return { ...defaults, ...given, mark: marks.mark(given.id) };
}

function block(f, view, o) {
  const { x, y, w, d, h, hue } = o;
  const z = o.z || 0;
  const x1 = x + w;
  const y1 = y + d;
  const z1 = z + h;
  const P = view.P;
  const hull = [P(x, y, z1), P(x1, y, z1), P(x1, y, z), P(x1, y1, z), P(x, y1, z), P(x, y1, z1)];
  const line = o.ink || hue;
  if (o.ghost) {
    f.polygon(hull, { fill: color('paper'), fillOpacity: 0.6, stroke: inkOf(line), strokeWidth: 1.3, dash: 'dashed' });
    return null;
  }
  if (o.shadow) f.isoShadow(view, { x, y, w, d, h, z });
  f.polygon(hull, { fill: color('panel') });
  f.polygon(hull, { fill: fillOf(hue) });
  if (o.tones !== false) {
    f.polygon([P(x, y, z1), P(x1, y, z1), P(x1, y1, z1), P(x, y1, z1)], { fill: color('shine'), fillOpacity: 0.45 });
    f.polygon([P(x1, y, z), P(x1, y1, z), P(x1, y1, z1), P(x1, y, z1)], { fill: color('shade'), fillOpacity: 0.16 });
  }
  edge(f, view, [[x1, y, z1], [x1, y1, z1], [x, y1, z1], [x1, y1, z1], [x1, y1, z]], line, 0.7);
  f.polygon(hull, { stroke: inkOf(line), strokeWidth: o.lw || 1.4, dash: o.dash });
  return { x, y, x1, y1, top: P(x + w / 2, y + d / 2, z1) };
}

function anchors(view, x, y, z, w, d, h) {
  const P = view.P;
  return {
    top: P(x + w / 2, y + d / 2, z + h),
    foot: P(x + w, y + d, z),
    near: P(x + w, y + d, z + h),
    left: P(x, y + d, z),
    right: P(x + w, y, z),
    back: P(x, y, z),
    P: (u, v, k = 0) => P(x + u, y + v, z + k),
  };
}

function fitOnFace(m, span, h, pad) {
  if (!m.size) m.size = r1(Math.min(span - 8, (h - pad) / m.mark.ratio, 40));
  const inset = m.inset === undefined ? (span - m.size) / 2 : m.inset;
  const rise = m.rise === undefined ? r1(h - (h - m.size * m.mark.ratio) / 2) : m.rise;
  return { inset, rise };
}

function endMark(f, view, option, hue, x1, y1, z, d, h) {
  const m = pick(option, {});
  if (!m) return;
  const { inset, rise } = fitOnFace(m, d, h, 4);
  marks.stamp(f, m.mark.onFace(view, [x1, y1 - inset, z + rise], [0, -1, 0], [0, 0, -1], m.size), m.hue || hue);
}

function terminal(f, raw, [x, y, z = 0], hue, o = {}) {
  const view = snap(raw);
  const { w = 44, d = 6, h = 36 } = o;
  const y1 = y + d;
  block(f, view, { x, y, z, w, d, h, hue, shadow: o.shadow !== false });
  tint(f, view, [[x, y1, z + h - 7], [x + w, y1, z + h - 7], [x + w, y1, z + h], [x, y1, z + h]], hue, 0.8);
  edge(f, view, [[x + 5, y1, z + h - 13], [x + 9, y1, z + h - 15.5], [x + 5, y1, z + h - 18]], hue, 1.2);
  tint(f, view, [[x + 13, y1, z + h - 16.5], [x + w - 8, y1, z + h - 16.5], [x + w - 8, y1, z + h - 14], [x + 13, y1, z + h - 14]], hue, 0.75);
  tint(f, view, [[x + 5, y1, z + 9], [x + w - 18, y1, z + 9], [x + w - 18, y1, z + 11.5], [x + 5, y1, z + 11.5]], hue, 0.4);
  quad(f, view, [[x + 4, y + 15, z], [x + w - 4, y + 15, z], [x + w - 4, y + 29, z], [x + 4, y + 29, z]], { fill: fillOf(hue), stroke: inkOf(hue), strokeWidth: 1.1 });
  return { ...anchors(view, x, y, z, w, d, h), foot: view.P(x + w, y + 29, z) };
}

function gateway(f, raw, [x, y, z = 0], hue, o = {}) {
  const view = snap(raw);
  const { w = 56, d = 56, h = 30, ports = 5 } = o;
  const x1 = x + w;
  const y1 = y + d;
  const pitch = (w - 6) / ports;
  const low = r1(h * 0.2);
  const high = low + r1((h * 7) / 30);
  block(f, view, { x, y, z, w, d, h, hue, shadow: o.shadow !== false });
  for (let i = 0; i < ports; i += 1) {
    const a = x + 5 + i * pitch;
    const b = a + pitch - 4;
    tint(f, view, [[a, y1, z + low], [b, y1, z + low], [b, y1, z + high], [a, y1, z + high]], hue, 0.75);
  }
  edge(f, view, [[x + 5, y1, z + r1(h * 0.7)], [x1 - 5, y1, z + r1(h * 0.7)]], hue, 0.8);
  endMark(f, view, o.mark, hue, x1, y1, z, d, h);
  return anchors(view, x, y, z, w, d, h);
}

function tower(f, raw, [x, y, z = 0], hue, o = {}) {
  const view = snap(raw);
  const { w = 44, d = 44, h = 46, units = 3 } = o;
  const x1 = x + w;
  const y1 = y + d;
  block(f, view, { x, y, z, w, d, h, hue, shadow: o.shadow !== false });
  for (let i = 1; i < units; i += 1) {
    const seam = z + r1((h * i) / units);
    edge(f, view, [[x, y1, seam], [x1, y1, seam], [x1, y, seam]], hue, 0.8);
  }
  for (let i = 0; i < units; i += 1) {
    const led = z + 5 + (units > 1 ? (i * (h - 15)) / (units - 1) : 0);
    tint(f, view, [[x + 4, y1, led], [x + 8, y1, led], [x + 8, y1, led + 4], [x + 4, y1, led + 4]], hue, 0.85);
  }
  endMark(f, view, o.mark, hue, x1, y1, z, d, h);
  return anchors(view, x, y, z, w, d, h);
}

function cylinder(f, raw, [x, y, z = 0], hue, o = {}) {
  const view = snap(raw);
  const { r = 22, h = 60, bands = [6, 13, 20], row = true } = o;
  const m = ISO[view.angle];
  const [cx, cy] = view.P(x, y, z + h);
  const rx = r * Math.SQRT2 * m.ax * view.s;
  const ry = r * Math.SQRT2 * m.ay * view.s;
  f.polygon([...ellipse(cx, cy + h, rx, ry, Math.PI, 0, 12), ...ellipse(cx, cy, rx, ry, 0, -Math.PI, 12)], { fill: color('panel') });
  f.isoDrum(view, { x, y, z, r, h, hue });
  const band = k => ellipse(cx, cy + h - k, rx, ry, Math.PI, 0, 12);
  if (row && bands.length > 1) f.polygon([...band(bands[0]), ...band(bands[1]).reverse()], { fill: inkOf(hue), fillOpacity: 0.3 });
  for (const k of bands) stroke(f, band(k), hue, 0.9);
  const mark = pick(o.mark, { size: Math.min(r * 1.4, 40), drop: 2.5 });
  if (mark) marks.stamp(f, mark.mark.flat(cx - mark.size / 2, cy + ry + mark.drop, mark.size), mark.hue || hue);
  return {
    top: [cx, r1(cy - ry)],
    center: [cx, cy],
    foot: [cx, r1(cy + h + ry)],
    left: [r1(cx - rx), r1(cy + h / 2)],
    right: [r1(cx + rx), r1(cy + h / 2)],
    rx,
    ry,
    rim: (k, a = 0.7) => [r1(cx + rx * a), r1(cy + h - k + ry * a)],
  };
}

function tile(f, raw, [x, y, z = 0], hue, o) {
  const view = snap(raw);
  const { w, d, dash = 'dashed', fill = 'paper' } = o;
  quad(f, view, [[x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z]], { fill: fill === 'paper' ? color('paper') : fillOf(fill), stroke: inkOf(hue), strokeWidth: 1.1, dash: dash === 'solid' ? undefined : dash });
  return anchors(view, x, y, z, w, d, 0);
}

function slab(f, raw, [x, y, z = 0], hue, o) {
  const view = snap(raw);
  const { w, d, thick = 10 } = o;
  block(f, view, { x, y, w, d, z: z - thick, h: thick, hue, shadow: o.shadow !== false });
  const mark = pick(o.mark, { size: 46 });
  if (mark) marks.stamp(f, mark.mark.onFloor(view, [mark.at[0], mark.at[1], z], mark.size), mark.hue || hue);
  return anchors(view, x, y, z, w, d, 0);
}

function frame(f, raw, [x, y, z = 0], hue, o) {
  const view = snap(raw);
  const { w, d, h } = o;
  const x1 = x + w;
  const y1 = y + d;
  const z1 = z + h;
  quad(f, view, [[x, y, z], [x1, y, z], [x1, y1, z], [x, y1, z]], { fill: fillOf(hue), stroke: inkOf(hue), strokeWidth: 1.1 });
  edge(f, view, [[x, y1, z1], [x, y, z1], [x1, y, z1]], hue, 1.1);
  edge(f, view, [[x, y, z], [x, y, z1]], hue, 1.1);
  return {
    ...anchors(view, x, y, z, w, d, h),
    front() {
      edge(f, view, [[x, y1, z], [x, y1, z1], [x1, y1, z1], [x1, y, z1], [x1, y, z]], hue, 1.1);
      edge(f, view, [[x1, y1, z], [x1, y1, z1]], hue, 1.1);
    },
  };
}

function shell(f, raw, [x, y, z = 0], hue, o) {
  const view = snap(raw);
  const { w, d, h, lip = 7 } = o;
  const x1 = x + w;
  const y1 = y + d;
  const z1 = z + h;
  const face = { fill: fillOf(hue), stroke: inkOf(hue), strokeWidth: 1.1 };
  quad(f, view, [[x, y, z], [x1, y, z], [x1, y, z1], [x, y, z1]], { ...face, fill: color('paper'), fillOpacity: 0.85 });
  quad(f, view, [[x, y, z], [x, y1, z], [x, y1, z1], [x, y, z1]], face);
  quad(f, view, [[x, y, z], [x1, y, z], [x1, y1, z], [x, y1, z]], face);
  const mark = pick(o.mark, {});
  if (mark) {
    const { inset, rise } = fitOnFace(mark, w, h, 8);
    marks.stamp(f, mark.mark.onFace(view, [x + inset, y, z + rise], [1, 0, 0], [0, 0, -1], mark.size), mark.hue || hue);
  }
  return {
    ...anchors(view, x, y, z, w, d, h),
    front() {
      quad(f, view, [[x, y1, z], [x1, y1, z], [x1, y1, z + lip], [x, y1, z + lip]], face);
      quad(f, view, [[x1, y, z], [x1, y1, z], [x1, y1, z + lip], [x1, y, z + lip]], face);
    },
  };
}

function stack(f, raw, [x, y, z = 0], hue, o = {}) {
  const view = snap(raw);
  const { w = 56, tiers = [[0, 0, 14], [7, 15, 12], [14, 28, 11]], ghost = false } = o;
  const drawn = tiers.map(([inset, rise, h], index) => {
    const tier = { x: x + inset, y: y + inset, w: w - inset * 2, d: w - inset * 2, z: z + rise, h, hue };
    if (ghost) return block(f, view, { ...tier, ghost: true });
    return { ...block(f, view, { ...tier, lw: 1.6, shadow: !index && o.shadow !== false }), z: z + rise, h };
  });
  if (ghost) return anchors(view, x, y, z, w, w, tiers[0][2]);
  if (drawn.length > 1) {
    const files = drawn[1];
    for (const k of [1, 2]) edge(f, view, [[files.x, files.y1, files.z + (files.h * k) / 3], [files.x1, files.y1, files.z + (files.h * k) / 3], [files.x1, files.y, files.z + (files.h * k) / 3]], hue, 0.7);
    const last = drawn[drawn.length - 1];
    const cx = (last.x + last.x1) / 2;
    const cy = (last.y + last.y1) / 2;
    edge(f, view, [[cx, last.y, last.z + last.h], [cx, last.y1, last.z + last.h]], hue, 0.7);
    edge(f, view, [[last.x, cy, last.z + last.h], [last.x1, cy, last.z + last.h]], hue, 0.7);
  }
  return { ...anchors(view, x, y, z, w, w, tiers[0][2]), tiers: drawn, top: drawn[drawn.length - 1].top };
}

function unit(f, raw, [x, y, z = 0], hue, o = {}) {
  const view = snap(raw);
  const { w = 36, d = 36, h = 28 } = o;
  const y1 = y + d;
  if (o.ghost) {
    block(f, view, { x, y, z, w, d, h, hue, ghost: true });
    return anchors(view, x, y, z, w, d, h);
  }
  block(f, view, { x, y, z, w, d, h, hue, shadow: o.shadow !== false });
  tint(f, view, [[x + 5, y1, z + h - 8], [x + 13, y1, z + h - 8], [x + 13, y1, z + h - 4], [x + 5, y1, z + h - 4]], hue, 0.8);
  edge(f, view, [[x + 5, y1, z + h - 16], [x + w - 5, y1, z + h - 16]], hue, 0.8);
  endMark(f, view, o.mark, hue, x + w, y1, z, d, h);
  return anchors(view, x, y, z, w, d, h);
}

function bucket(f, raw, [x, y, z = 0], hue, o = {}) {
  const view = snap(raw);
  const { k = 1, sheets: count = 2 } = o;
  const m = ISO[view.angle];
  const squash = m.ay / m.ax;
  const [bx, by] = view.P(x, y, z);
  const tall = 34 * k;
  const top = r1(27 * k * squash);
  const side = [[r1(bx - 27 * k), by - tall], ...ellipse(bx, by, 21 * k, r1(21 * k * squash), Math.PI, 0, 12), [r1(bx + 27 * k), by - tall]];
  f.polygon(side, { fill: color('panel') });
  f.polygon(side, { fill: fillOf(hue), stroke: inkOf(hue), strokeWidth: 1.4 });
  f.polygon(ellipse(bx, by - tall, 27 * k, top, 0, Math.PI * 2, 24).slice(0, -1), { fill: fillOf(hue), stroke: inkOf(hue), strokeWidth: 1.4 });
  f.polygon(ellipse(bx, by - (tall - k), 22 * k, r1(top - 3.6 * k), 0, Math.PI * 2, 20).slice(0, -1), { fill: color('shade'), fillOpacity: 0.22 });
  for (let i = 0; i < count; i += 1) {
    const v = y + (-5 + i * 8) * k;
    quad(f, view, [[x - 9 * k, v, z + 30 * k], [x + 9 * k, v, z + 30 * k], [x + 9 * k, v, z + 50 * k], [x - 9 * k, v, z + 50 * k]], { fill: color('paper'), stroke: inkOf(hue), strokeWidth: 1 });
  }
  return {
    top: [bx, r1(by - tall - top)],
    center: [bx, r1(by - tall)],
    foot: [bx, r1(by + 21 * k * squash)],
    left: [r1(bx - 24 * k), r1(by - tall / 2)],
    right: [r1(bx + 24 * k), r1(by - tall / 2)],
  };
}

function sheets(f, raw, [x, y, z = 0], hue, o = {}) {
  const view = snap(raw);
  const { size = 16, count = 3, gap = 3 } = o;
  for (let i = 0; i < count; i += 1) {
    const k = z + i * gap;
    quad(f, view, [[x, y, k], [x + size, y, k], [x + size, y + size, k], [x, y + size, k]], { fill: fillOf(hue), stroke: inkOf(hue), strokeWidth: 1 });
  }
  return anchors(view, x, y, z, size, size, (count - 1) * gap);
}

function plate(f, points, options) {
  f.polygon(points.map(([x, y]) => [r1(x), r1(y)]), options);
}

function pane(f, x, y, w, h, options) {
  plate(f, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], options);
}

function body(f, x, y, w, h, hue, o = {}) {
  pane(f, x, y, w, h, { fill: color('panel') });
  pane(f, x, y, w, h, { fill: o.fill || fillOf(hue), fillOpacity: o.fillOpacity, stroke: inkOf(hue), strokeWidth: o.lw || 1.3, dash: o.dash });
}

function wash(f, x, y, w, h, hue, opacity) {
  pane(f, x, y, w, h, { fill: inkOf(hue), fillOpacity: opacity });
}

function ghostPane(f, x, y, w, h, hue) {
  pane(f, x, y, w, h, { fill: color('paper'), fillOpacity: 0.6, stroke: inkOf(hue), strokeWidth: 1.2, dash: 'dashed' });
}

function stroke(f, points, hue, width = 0.8, dash) {
  f.path(points.map(([x, y], index) => `${index ? 'L' : 'M'}${r1(x)} ${r1(y)}`).join(''), { hue, head: false, width, dash });
}

function bounds(x, y, w, h) {
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2, top: [x + w / 2, y], bottom: [x + w / 2, y + h], left: [x, y + h / 2], right: [x + w, y + h / 2] };
}

function inZone(f, option, hue, x, y, w, h) {
  const mark = pick(option, {});
  if (!mark) return;
  const size = Math.min(mark.size || 40, w, h / mark.mark.ratio);
  marks.stamp(f, mark.mark.flat(r1(x + (w - size) / 2), r1(y + (h - size * mark.mark.ratio) / 2), r1(size)), mark.hue || hue);
}

const flat = {
  terminal(f, cx, y, hue, o = {}) {
    const { w = 44, h = 34 } = o;
    const x = cx - w / 2;
    body(f, x, y, w, h - 8, hue);
    wash(f, x, y, w, 5, hue, 0.8);
    stroke(f, [[x + 5, y + 10], [x + 9, y + 13], [x + 5, y + 16]], hue, 1.2);
    wash(f, x + 13, y + 11.8, w - 22, 2.5, hue, 0.75);
    wash(f, x + 5, y + 19, w - 24, 2.5, hue, 0.4);
    plate(f, [[x + 5, y + h - 5], [x + w - 5, y + h - 5], [x + w, y + h], [x, y + h]], { fill: fillOf(hue), stroke: inkOf(hue), strokeWidth: 1.1 });
    return bounds(x, y, w, h);
  },
  gateway(f, cx, y, hue, o = {}) {
    const { w = 56, h = 40, ports = 5 } = o;
    const x = cx - w / 2;
    const pitch = (w - 6) / ports;
    body(f, x, y, w, h, hue);
    for (let i = 0; i < ports; i += 1) wash(f, x + 5 + i * pitch, y + h - 10, pitch - 4, 6, hue, 0.75);
    stroke(f, [[x + 5, y + h - 14], [x + w - 5, y + h - 14]], hue);
    inZone(f, o.mark, hue, x + 4, y + 3, w - 8, h - 19);
    return bounds(x, y, w, h);
  },
  tower(f, cx, y, hue, o = {}) {
    const { w = 42, h = 48, units = 3 } = o;
    const x = cx - w / 2;
    body(f, x, y, w, h, hue);
    stroke(f, [[x + 11, y], [x + 11, y + h]], hue);
    for (let i = 1; i < units; i += 1) stroke(f, [[x, y + (h * i) / units], [x + 11, y + (h * i) / units]], hue);
    for (let i = 0; i < units; i += 1) wash(f, x + 3.5, y + (h * (i + 0.5)) / units - 2, 4, 4, hue, 0.85);
    inZone(f, o.mark, hue, x + 13, y + 3, w - 15, h - 6);
    return bounds(x, y, w, h);
  },
  cylinder(f, cx, y, hue, o = {}) {
    const { w = 44, h = 58, bands = [5, 10], row = true } = o;
    const x = cx - w / 2;
    const rx = w / 2;
    const ry = 6;
    const side = [[x, y + ry], ...ellipse(cx, y + h - ry, rx, ry, Math.PI, 0, 10), [x + w, y + ry]];
    f.polygon(side, { fill: color('panel') });
    f.polygon(side, { fill: fillOf(hue), stroke: inkOf(hue), strokeWidth: 1.3 });
    const band = k => ellipse(cx, y + h - ry - k, rx, ry, Math.PI, 0, 10);
    if (row) f.polygon([...band(0), ...band(bands[0]).reverse()], { fill: inkOf(hue), fillOpacity: 0.3 });
    for (const k of bands) stroke(f, band(k), hue, 0.9);
    const lid = ellipse(cx, y + ry, rx, ry, 0, Math.PI * 2, 20).slice(0, -1);
    f.polygon(lid, { fill: fillOf(hue), stroke: inkOf(hue), strokeWidth: 1.3 });
    f.polygon(lid, { fill: color('shine'), fillOpacity: 0.45 });
    inZone(f, o.mark, hue, x + 5, y + ry * 2 + 2, w - 10, h - ry * 3 - bands[bands.length - 1] - 3);
    return bounds(x, y, w, h);
  },
  tile(f, cx, y, hue, o) {
    const { w, h } = o;
    pane(f, cx - w / 2, y, w, h, { fill: color('paper'), stroke: inkOf(hue), strokeWidth: 1.1, dash: 'dashed' });
    return bounds(cx - w / 2, y, w, h);
  },
  slab(f, cx, y, hue, o) {
    const { w, h = 9 } = o;
    const x = cx - w / 2;
    body(f, x, y, w, h, hue);
    wash(f, x, y + h - 3, w, 3, hue, 0.3);
    return bounds(x, y, w, h);
  },
  frame(f, cx, y, hue, o = {}) {
    const { w = 52, h = 44 } = o;
    const x = cx - w / 2;
    body(f, x, y, w, h, hue, { lw: 1.1 });
    for (const [px, py] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) wash(f, px - 1.5, py - 1.5, 3, 3, hue, 1);
    return bounds(x, y, w, h);
  },
  shell(f, cx, y, hue, o = {}) {
    const { w = 44, h = 34, wall = 3 } = o;
    const x = cx - w / 2;
    pane(f, x, y, w, h, { fill: color('paper'), fillOpacity: 0.85 });
    plate(f, [[x, y], [x + wall, y], [x + wall, y + h - wall], [x + w - wall, y + h - wall], [x + w - wall, y], [x + w, y], [x + w, y + h], [x, y + h]], { fill: fillOf(hue), stroke: inkOf(hue), strokeWidth: 1.1 });
    inZone(f, o.mark, hue, x + wall + 2, y + 2, o.zone || w - wall * 2 - 4, h - wall - 4);
    return bounds(x, y, w, h);
  },
  stack(f, cx, y, hue, o = {}) {
    const { w = 32, h = 30, ghost = false } = o;
    const x = cx - w / 2;
    const step = h / 3;
    [0, 1, 2].forEach(index => {
      const inset = (2 - index) * w * 0.16;
      const top = y + index * step;
      if (ghost) ghostPane(f, x + inset, top + 1, w - inset * 2, step - 1, hue);
      else body(f, x + inset, top + 1, w - inset * 2, step - 1, hue, { lw: 1.4 });
    });
    if (!ghost) stroke(f, [[x + w * 0.16 + 3, y + step * 1.5 + 0.5], [x + w * 0.84 - 3, y + step * 1.5 + 0.5]], hue, 0.7);
    return bounds(x, y, w, h);
  },
  unit(f, cx, y, hue, o = {}) {
    const { w = 32, h = 28, ghost = false } = o;
    const x = cx - w / 2;
    if (ghost) {
      ghostPane(f, x, y, w, h, hue);
      return bounds(x, y, w, h);
    }
    body(f, x, y, w, h, hue);
    wash(f, x + 4, y + 4, 7, 3.5, hue, 0.8);
    stroke(f, [[x + 4, y + 11], [x + w - 4, y + 11]], hue);
    inZone(f, o.mark, hue, x + 3, y + 13, w - 6, h - 15);
    return bounds(x, y, w, h);
  },
  bucket(f, cx, y, hue, o = {}) {
    const { w = 40, h = 40 } = o;
    const x = cx - w / 2;
    const side = [[x, y + 13], ...ellipse(cx, y + h - 5, w * 0.38, 5, Math.PI, 0, 10), [x + w, y + 13]];
    f.polygon(side, { fill: color('panel') });
    f.polygon(side, { fill: fillOf(hue), stroke: inkOf(hue), strokeWidth: 1.3 });
    f.polygon(ellipse(cx, y + 13, w / 2, 6, 0, Math.PI * 2, 20).slice(0, -1), { fill: fillOf(hue), stroke: inkOf(hue), strokeWidth: 1.3 });
    f.polygon(ellipse(cx, y + 13.5, w / 2 - 4, 4, 0, Math.PI * 2, 16).slice(0, -1), { fill: color('shade'), fillOpacity: 0.22 });
    pane(f, cx - 10, y, 10, 14, { fill: color('paper'), stroke: inkOf(hue), strokeWidth: 1 });
    pane(f, cx - 3, y + 2, 10, 14, { fill: color('paper'), stroke: inkOf(hue), strokeWidth: 1 });
    return bounds(x, y, w, h);
  },
  sheets(f, cx, y, hue, o = {}) {
    const { w = 20, h = 18, count = 3 } = o;
    const x = cx - w / 2;
    const gap = 3;
    for (let i = count - 1; i >= 0; i -= 1) pane(f, x + (count - 1 - i) * gap, y + i * gap, w - (count - 1) * gap, h - (count - 1) * gap, { fill: fillOf(hue), stroke: inkOf(hue), strokeWidth: 1 });
    return bounds(x, y, w, h);
  },
};

module.exports = { block, bucket, cylinder, edge, flat, frame, gateway, isoView, quad, sheets, shell, slab, stack, terminal, tile, tint, tower, unit };
