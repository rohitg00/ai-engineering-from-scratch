'use strict';

const { WIDTH, color, escapeHtml, measure } = require('./figkit.js');

const TITLE = 11.5;
const META = 11;
const ROW_GAP = 18;
const NODE_GAP = 26;
const LANE_GAP = 12;
const LANE_PAD = 16;

function unescapeId(raw) {
  return raw.replace(/\\([0-9a-f]{2})/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function stripTags(text) {
  return text.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function parseLabel(raw) {
  let body = raw.trim();
  if (body.startsWith('[') && body.endsWith(']')) body = body.slice(1, -1);
  const [name, ...rest] = body.split(/<hr\s*\/?>/);
  const meta = rest.length ? stripTags(rest.join(' ')) : '';
  return { label: stripTags(name), meta };
}

function parse(text) {
  const nodes = new Map();
  const edges = [];
  const clusters = new Map();
  const stack = [];
  const lines = text.split('\n');
  let start = lines.findIndex(line => /^\s*graph\s+(TD|TB);?\s*$/.test(line));
  if (start < 0) throw new Error('graphviz-lite: no "graph TD;" line');
  const ensure = id => {
    if (!nodes.has(id)) nodes.set(id, { id, label: id, meta: '', kind: 'node', cluster: null, seen: nodes.size });
    return nodes.get(id);
  };
  for (const rawLine of lines.slice(start + 1)) {
    const line = rawLine.trim().replace(/;$/, '');
    if (!line) continue;
    if (/^(classDef|style|linkStyle|class)\s/.test(line)) continue;
    let match = /^subgraph\s+(.+)$/.exec(line);
    if (match) {
      const name = unescapeId(match[1].trim());
      stack.push(name);
      if (!clusters.has(name)) clusters.set(name, []);
      continue;
    }
    if (line === 'end') {
      if (!stack.length) throw new Error('graphviz-lite: "end" with no open subgraph');
      stack.pop();
      continue;
    }
    match = /^(\S+?)\s*(-->|-\.->|-\.\s*(.*?)\s*\.->|--\s*(.*?)\s*-->)\s*(\S+)$/.exec(line);
    if (match) {
      const from = unescapeId(match[1]);
      const to = unescapeId(match[5]);
      const conditional = match[2].startsWith('-.');
      const label = stripTags(match[3] || match[4] || '');
      ensure(from);
      ensure(to);
      edges.push({ from, to, conditional, label, index: edges.length });
      continue;
    }
    match = /^([^\s(]+)\((.*)\)(?::::(\w+))?$/.exec(line);
    if (match) {
      const node = ensure(unescapeId(match[1]));
      Object.assign(node, parseLabel(match[2]));
      if (match[3] === 'first' || node.id === '__start__') node.kind = 'start';
      if (match[3] === 'last' || node.id === '__end__') node.kind = 'end';
      if (stack.length) {
        node.cluster = stack[stack.length - 1];
        clusters.get(node.cluster).push(node.id);
      }
      continue;
    }
    throw new Error(`graphviz-lite: cannot parse line "${line}"`);
  }
  return { nodes, edges, clusters };
}

function fromCapture(text, heading) {
  const at = text.indexOf(`\n## ${heading}\n`);
  if (at < 0) throw new Error(`graphviz-lite: heading "## ${heading}" not found`);
  const next = text.indexOf('\n## ', at + heading.length + 4);
  return parse(text.slice(at, next < 0 ? text.length : next));
}

function wrap(text, max, size) {
  const out = [];
  let line = '';
  for (const word of text.split(' ')) {
    const trial = line ? `${line} ${word}` : word;
    if (line && measure(trial, size, true) > max) {
      out.push(line);
      line = word;
    } else line = trial;
  }
  if (line) out.push(line);
  return out;
}

function layers(graph) {
  const ids = [...graph.nodes.keys()].sort((a, b) => {
    const rank = id => (graph.nodes.get(id).kind === 'start' ? -1 : 0);
    return rank(a) - rank(b) || graph.nodes.get(a).seen - graph.nodes.get(b).seen;
  });
  const out = new Map(ids.map(id => [id, []]));
  for (const edge of graph.edges) if (edge.from !== edge.to) out.get(edge.from).push(edge);
  const state = new Map();
  const back = new Set();
  const visit = id => {
    state.set(id, 1);
    for (const edge of out.get(id)) {
      const s = state.get(edge.to);
      if (s === 1) back.add(edge.index);
      else if (!s) visit(edge.to);
    }
    state.set(id, 2);
  };
  for (const id of ids) if (!state.get(id)) visit(id);
  const forward = graph.edges.filter(edge => edge.from !== edge.to && !back.has(edge.index));
  const layer = new Map(ids.map(id => [id, 0]));
  for (let changed = true, guard = 0; changed; guard += 1) {
    if (guard > ids.length + 1) throw new Error('graphviz-lite: layering did not settle');
    changed = false;
    for (const edge of forward) {
      if (layer.get(edge.to) < layer.get(edge.from) + 1) {
        layer.set(edge.to, layer.get(edge.from) + 1);
        changed = true;
      }
    }
  }
  return { ids, layer, back };
}

function layout(graph, options = {}) {
  const center = options.center || WIDTH / 2;
  const top = options.top || 40;
  const hueOf = options.hue || (() => 'indigo');
  const metaMax = options.metaMax || 300;
  const { ids, layer, back } = layers(graph);
  for (const [id, rank] of Object.entries(options.rank || {})) layer.set(id, rank);
  const depth = Math.max(...layer.values()) + 1;
  const rows = Array.from({ length: depth }, () => []);
  for (const id of ids) rows[layer.get(id)].push(id);

  const boxes = new Map();
  for (const id of ids) {
    const node = graph.nodes.get(id);
    const label = options.labels && options.labels[id] ? options.labels[id] : node.label;
    const meta = options.meta === false || !node.meta ? [] : wrap(node.meta, metaMax, META);
    const terminal = node.kind !== 'node';
    const w = 2 * Math.ceil(Math.max(terminal ? 0 : 84, measure(label, TITLE) + (terminal ? 28 : 22), ...meta.map(line => measure(line, META, true) + 22)) / 2);
    const h = 24 + meta.length * 15;
    boxes.set(id, { id, node, label, meta, w, h, hue: terminal ? null : hueOf(node), x: 0, y: 0 });
  }

  const pos = new Map();
  const prefer = options.prefer || {};
  rows.forEach((row, r) => {
    const bary = id => {
      if (prefer[id] !== undefined) return prefer[id];
      const preds = graph.edges.filter(edge => edge.to === id && edge.from !== id && layer.get(edge.from) < r).map(edge => pos.get(edge.from));
      return preds.length ? preds.reduce((a, b) => a + b, 0) / preds.length : 0;
    };
    const keyed = row.map(id => ({ id, key: bary(id), seen: graph.nodes.get(id).seen }));
    keyed.sort((a, b) => a.key - b.key || a.seen - b.seen);
    row.splice(0, row.length, ...keyed.map(item => item.id));
    const want = row.map(id => {
      const preds = graph.edges.filter(edge => edge.to === id && !back.has(edge.index) && layer.get(edge.from) === r - 1).map(edge => pos.get(edge.from));
      return preds.length ? preds.reduce((a, b) => a + b, 0) / preds.length : center;
    });
    const lefts = [];
    row.forEach((id, i) => {
      const w = boxes.get(id).w;
      lefts.push(i ? Math.max(want[i] - w / 2, lefts[i - 1] + boxes.get(row[i - 1]).w + NODE_GAP) : want[i] - w / 2);
    });
    const drift = row.reduce((sum, id, i) => sum + lefts[i] + boxes.get(id).w / 2 - want[i], 0) / row.length;
    const lo = 20 - (lefts[0] - drift);
    const hi = WIDTH - 20 - (lefts[row.length - 1] - drift + boxes.get(row[row.length - 1]).w);
    const shift = -drift + Math.max(0, lo) + Math.min(0, hi);
    row.forEach((id, i) => {
      const box = boxes.get(id);
      box.x = Math.round(lefts[i] + shift + box.w / 2) - box.w / 2;
      pos.set(id, box.x + box.w / 2);
    });
  });

  let y = top;
  const rowY = [];
  rows.forEach(row => {
    const h = Math.max(...row.map(id => boxes.get(id).h));
    rowY.push({ y, h });
    for (const id of row) {
      const box = boxes.get(id);
      box.y = y + (h - box.h) / 2;
    }
    y += h + ROW_GAP;
  });
  const bottom = y - ROW_GAP;

  const extreme = (id, side) => {
    const row = rows[layer.get(id)];
    return side === 'left' ? row[0] === id : row[row.length - 1] === id;
  };
  const rowExtent = (r, side) => {
    const row = rows[r];
    return side === 'left' ? Math.min(...row.map(id => boxes.get(id).x)) : Math.max(...row.map(id => boxes.get(id).x + boxes.get(id).w));
  };

  const straight = [];
  const lanes = [];
  const loops = [];
  const used = { left: 0, right: 0 };
  for (const edge of graph.edges) {
    if (edge.from === edge.to) {
      loops.push(edge);
      continue;
    }
    const d = layer.get(edge.to) - layer.get(edge.from);
    if (Math.abs(d) === 1) {
      straight.push({ edge, up: d < 0 });
      continue;
    }
    const key = `${edge.from}->${edge.to}`;
    const sides = options.side && options.side[key] ? [options.side[key]] : ['right', 'left'].filter(side => extreme(edge.from, side) && extreme(edge.to, side));
    if (!sides.length) throw new Error(`graphviz-lite: edge ${key} spans ${Math.abs(d)} rows and neither side is clear; set options.prefer or options.side`);
    const side = sides.length === 1 ? sides[0] : used.left < used.right ? 'left' : 'right';
    used[side] += 1;
    const r0 = Math.min(layer.get(edge.from), layer.get(edge.to));
    const r1 = Math.max(layer.get(edge.from), layer.get(edge.to));
    lanes.push({ edge, side, r0, r1, span: r1 - r0 });
  }
  for (const side of ['left', 'right']) {
    const placed = [];
    for (const lane of lanes.filter(l => l.side === side).sort((a, b) => a.span - b.span || a.edge.index - b.edge.index)) {
      let base = -Infinity;
      for (let r = lane.r0; r <= lane.r1; r += 1) base = Math.max(base, side === 'right' ? rowExtent(r, side) : -rowExtent(r, side));
      let offset = base + LANE_PAD;
      for (const other of placed) if (other.r0 <= lane.r1 && lane.r0 <= other.r1) offset = Math.max(offset, other.offset + LANE_GAP);
      lane.offset = offset;
      lane.x = side === 'right' ? offset : -offset;
      placed.push(lane);
    }
  }
  for (const lane of lanes) if (lane.x < 4 || lane.x > WIDTH - 4) throw new Error(`graphviz-lite: lane for ${lane.edge.from}->${lane.edge.to} runs outside the figure`);
  for (const box of boxes.values()) if (box.x < 4 || box.x + box.w > WIDTH - 4) throw new Error(`graphviz-lite: node ${box.id} is ${box.w} wide and runs outside the figure`);

  return { graph, boxes, rows, rowY, layer, back, straight, lanes, loops, bottom, options };
}

function spread(count, width) {
  const span = Math.min(width * 0.6, (count - 1) * 16);
  return Array.from({ length: count }, (_, i) => (count === 1 ? 0 : -span / 2 + (span * i) / (count - 1)));
}

function style(edge) {
  return { style: edge.conditional ? 'state' : 'call' };
}

function pill(f, box) {
  f.emit(`<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="${box.h / 2}" fill="${color('paper')}" stroke="${color('ink-mute')}"/>`);
  f.text(box.x + box.w / 2, box.y + box.h / 2 + 4, box.label, { size: TITLE, anchor: 'middle', hue: 'ink-soft' });
}

function draw(f, plan) {
  const { graph, boxes, straight, lanes, loops } = plan;
  const ports = new Map();
  const port = (id, face, entry) => {
    const key = `${id}:${face}`;
    if (!ports.has(key)) ports.set(key, []);
    ports.get(key).push(entry);
  };
  for (const item of straight) {
    const { edge, up } = item;
    port(edge.from, up ? 'top' : 'bottom', { item, other: edge.to, dir: up ? 1 : 0 });
    port(edge.to, up ? 'bottom' : 'top', { item, other: edge.from, dir: up ? 1 : 0 });
  }
  const at = new Map();
  for (const [key, list] of ports) {
    const [id, face] = key.split(/:(?=[a-z]+$)/);
    const box = boxes.get(id);
    list.sort((a, b) => {
      const ax = boxes.get(a.other).x + boxes.get(a.other).w / 2;
      const bx = boxes.get(b.other).x + boxes.get(b.other).w / 2;
      return ax - bx || a.dir - b.dir;
    });
    const offsets = spread(list.length, box.w);
    list.forEach((entry, i) => at.set(`${entry.item.edge.index}:${id}:${face}`, box.x + box.w / 2 + offsets[i]));
  }
  const sidePorts = new Map();
  for (const lane of lanes) {
    for (const id of [lane.edge.from, lane.edge.to]) {
      const key = `${id}:${lane.side}`;
      if (!sidePorts.has(key)) sidePorts.set(key, []);
      sidePorts.get(key).push(lane);
    }
  }

  for (const [name, members] of graph.clusters) {
    const list = members.map(id => boxes.get(id));
    const x = Math.min(...list.map(b => b.x)) - 10;
    const y = Math.min(...list.map(b => b.y)) - 8;
    const w = Math.max(...list.map(b => b.x + b.w)) + 10 - x;
    const h = Math.max(...list.map(b => b.y + b.h)) + 8 - y;
    f.rect(x, y, w, h, { stroke: color('indigo-ink'), dash: 'dashed' });
    f.text(x + w + 8, y + 12, `subgraph ${name}`, { size: 11, hue: 'indigo' });
  }

  const labels = [];
  for (const item of straight) {
    const { edge, up } = item;
    const a = boxes.get(edge.from);
    const b = boxes.get(edge.to);
    const x1 = at.get(`${edge.index}:${edge.from}:${up ? 'top' : 'bottom'}`);
    const x2 = at.get(`${edge.index}:${edge.to}:${up ? 'bottom' : 'top'}`);
    const y1 = up ? a.y : a.y + a.h;
    const y2 = up ? b.y + b.h + 1 : b.y - 1;
    f.line(x1, y1, x2, y2, style(edge));
    if (edge.label) labels.push({ x: (x1 + x2) / 2, y: (y1 + y2) / 2 + 4, edge });
  }
  for (const lane of lanes) {
    const { edge, side } = lane;
    const yOf = id => {
      const box = boxes.get(id);
      const list = sidePorts.get(`${id}:${side}`);
      const offsets = list.length === 1 ? [0] : list.map((_, i) => (i - (list.length - 1) / 2) * 7);
      return box.y + box.h / 2 + offsets[list.indexOf(lane)];
    };
    const xOf = (id, gap) => (side === 'right' ? boxes.get(id).x + boxes.get(id).w + gap : boxes.get(id).x - gap);
    const y1 = yOf(edge.from);
    const y2 = yOf(edge.to);
    f.path(`M${xOf(edge.from, 0)} ${y1} H${lane.x} V${y2} H${xOf(edge.to, 1)}`, style(edge));
    if (edge.label) labels.push({ x: lane.x, y: (y1 + y2) / 2 + 4, edge });
  }
  for (const edge of loops) {
    const box = boxes.get(edge.from);
    const busy = side => sidePorts.has(`${edge.from}:${side}`);
    const side = busy('right') && !busy('left') ? 'left' : 'right';
    const x0 = side === 'right' ? box.x + box.w : box.x;
    const out = side === 'right' ? x0 + 18 : x0 - 18;
    const cy = box.y + box.h / 2;
    f.path(`M${x0} ${cy - 6} H${out} V${cy + 6} H${side === 'right' ? x0 + 1 : x0 - 1}`, style(edge));
  }
  for (const box of boxes.values()) {
    if (!box.hue) pill(f, box);
    else f.box({ x: box.x, y: box.y, w: box.w, h: box.h, hue: box.hue, title: box.label, titleSize: TITLE, sub: box.meta, pad: 6, weight: box.node.kind === 'node' && box.label.includes('.') ? 400 : 700 });
  }
  for (const label of labels) f.text(label.x, label.y, label.edge.label, { size: 11, anchor: 'middle', hue: label.edge.conditional ? 'amber' : undefined, knock: true });
  return plan;
}

function legend(f, y, options = {}) {
  const x = options.x || 20;
  f.line(x, y - 4, x + 34, y - 4, { style: 'call' });
  const a = f.text(x + 42, y, options.plain || 'plain edge', { size: 11, serif: true, hue: 'ink-soft' });
  const x2 = a.right + 24;
  f.line(x2, y - 4, x2 + 34, y - 4, { style: 'state' });
  const b = f.text(x2 + 42, y, options.conditional || 'conditional edge, chosen at run time', { size: 11, serif: true, hue: 'ink-soft' });
  return b;
}

function summary(graph) {
  const nodes = [...graph.nodes.values()];
  const plain = graph.edges.filter(edge => !edge.conditional).length;
  const conditional = graph.edges.length - plain;
  return { nodes: nodes.length, edges: graph.edges.length, plain, conditional, names: nodes.map(node => node.id) };
}

module.exports = { parse, fromCapture, layout, draw, legend, summary, escapeHtml };
