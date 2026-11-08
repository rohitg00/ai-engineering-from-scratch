#!/usr/bin/env node
import { writeFileSync } from 'node:fs';

const WIDTH = 640;
const MAX_HEIGHT = 760;
const MIN_FONT = 11;
const MONO = 0.6;
const SERIF = 0.54;
const SERIF_FONT = 'Source Serif 4, Georgia, serif';
const ASCENT = 0.78;
const DESCENT = 0.22;

const TOKENS = {
  paper: '#fafaf5',
  panel: '#f3f1e8',
  'panel-edge': '#e4e1d4',
  ink: '#1a1a1a',
  'ink-soft': '#4a4a4a',
  'ink-mute': '#6f6f6a',
  'grey-ink': '#5e5e59', 'grey-fill': '#ecebe3',
  'blue-ink': '#2f5d9a', 'blue-fill': '#e6edf6',
  'teal-ink': '#18696a', 'teal-fill': '#e1efee',
  'violet-ink': '#5b4fa3', 'violet-fill': '#ebe8f5',
  'green-ink': '#336b40', 'green-fill': '#e5f0e4',
  'amber-ink': '#85590c', 'amber-fill': '#f5ecd9',
  'plum-ink': '#8a3d72', 'plum-fill': '#f4e6ef',
  'olive-ink': '#515f26', 'olive-fill': '#eef0dc',
  'indigo-ink': '#4b4f9e', 'indigo-fill': '#e9e9f6',
  'rose-ink': '#b0344d', 'rose-fill': '#f7e4e7',
};
const NEUTRALS = ['ink', 'ink-soft', 'ink-mute', 'paper', 'panel', 'panel-edge'];
const DASH = { solid: null, dashed: '5 4', dotted: '1.5 3.5' };
const STYLES = {
  call: ['ink', 'solid'],
  reply: ['ink', 'dashed'],
  write: ['teal', 'solid'],
  state: ['amber', 'dashed'],
  model: ['plum', 'solid'],
  effect: ['olive', 'dashed'],
  event: ['indigo', 'dotted'],
  fail: ['rose', 'dashed'],
};

const color = name => {
  if (!TOKENS[name]) throw new Error(`unknown token ${name}`);
  return `var(--m-${name}, ${TOKENS[name]})`;
};
const ink = hue => color(NEUTRALS.includes(hue) ? hue : `${hue}-ink`);
const fill = hue => color(NEUTRALS.includes(hue) ? hue : `${hue}-fill`);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const attrs = map => Object.entries(map).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
const measure = (text, size, serif, spacing = 0) => {
  const n = Array.from(String(text)).length;
  return n * size * (serif ? SERIF : MONO) + Math.max(0, n - 1) * spacing;
};

function figure(id, { height, title, desc }, draw) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) throw new Error(`bad id ${id}`);
  if (height > MAX_HEIGHT) throw new Error(`${id}: height ${height} is above ${MAX_HEIGHT}`);
  if (!title || !desc || desc.length < 40) throw new Error(`${id}: a title and a desc of at least 40 characters are required`);
  const out = [];
  const heads = new Set();

  const f = {
    text(x, y, content, o = {}) {
      const size = o.size || 12;
      const anchor = o.anchor || 'start';
      const w = measure(content, size, o.serif, o.spacing);
      const left = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
      if (size < MIN_FONT) throw new Error(`${id}: "${content}" is ${size} units, minimum ${MIN_FONT}`);
      if (/…|\.\.\./.test(content)) throw new Error(`${id}: no ellipsis in "${content}"`);
      if (o.max && w > o.max) throw new Error(`${id}: "${content}" is ${Math.ceil(w)} wide, max ${o.max}`);
      if (left < 1 || left + w > WIDTH - 1 || y - ASCENT * size < 1 || y + DESCENT * size > height - 1) throw new Error(`${id}: "${content}" runs outside the figure`);
      if (o.knock) out.push(`<rect${attrs({ class: 'm-knock', x: left - 3, y: y - ASCENT * size - 2, width: w + 6, height: size + 4, fill: color('panel') })}/>`);
      out.push(`<text${attrs({
        x, y, 'font-size': size,
        'text-anchor': anchor === 'start' ? undefined : anchor,
        'font-weight': o.weight,
        'letter-spacing': o.spacing,
        class: o.serif ? 'm-serif' : undefined,
        'font-family': o.serif ? SERIF_FONT : undefined,
        fill: o.hue ? ink(o.hue) : undefined,
      })}>${esc(content)}</text>`);
    },
    kicker(x, y, content) {
      f.text(x, y, String(content).toUpperCase(), { size: 11, spacing: 1.2, hue: 'ink-mute' });
    },
    box({ x, y, w, h, hue = 'grey', title: t, sub, dash, center }) {
      const left = center ? x - w / 2 : x;
      out.push(`<rect${attrs({ x: left, y, width: w, height: h, fill: fill(hue), stroke: ink(hue), 'stroke-dasharray': dash ? DASH[dash] : undefined })}/>`);
      const cx = left + w / 2;
      const inner = w - 24;
      if (sub) {
        f.text(cx, y + h / 2 - 2, t, { size: 12.5, weight: 700, anchor: 'middle', max: inner });
        f.text(cx, y + h / 2 + 12, sub, { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle', max: inner });
      } else {
        f.text(cx, y + h / 2 + 4.5, t, { size: 12.5, weight: 700, anchor: 'middle', max: inner });
      }
      return { x: left, y, w, h, cx, cy: y + h / 2 };
    },
    lifeline(x, y1, y2) {
      out.push(`<line${attrs({ x1: x, y1, x2: x, y2, stroke: color('ink-mute'), 'stroke-width': 1, 'stroke-dasharray': '2 3' })}/>`);
    },
    step(x, y, n) {
      out.push(`<circle${attrs({ cx: x, cy: y, r: 9, fill: color('paper'), stroke: color('ink'), 'stroke-width': 1 })}/>`);
      f.text(x, y + 4, String(n), { size: 11, anchor: 'middle' });
    },
    arrow([x1, y1], [x2, y2], { style = 'call', label, note } = {}) {
      const [hue, dash] = STYLES[style];
      heads.add(hue);
      out.push(`<line${attrs({
        x1, y1, x2, y2, stroke: ink(hue), 'stroke-width': 1.2,
        'stroke-dasharray': DASH[dash] || undefined,
        'stroke-linecap': dash === 'dotted' ? 'round' : undefined,
        'marker-end': `url(#${id}-head-${hue})`,
      })}/>`);
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      if (label) f.text(mx, my - 6, label, { size: 11.5, anchor: 'middle', hue: hue === 'ink' ? undefined : hue, knock: true });
      if (note) f.text(mx, my + 15, note, { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle', knock: true });
    },
  };

  draw(f);
  const defs = [...heads].map(hue => `<marker id="${id}-head-${hue}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 1 L10 5 L0 9 z" fill="${ink(hue)}"/></marker>`);
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-labelledby="${id}-title ${id}-desc" font-family="JetBrains Mono, ui-monospace, monospace" fill="${color('ink')}">`,
    `  <title id="${id}-title">${esc(title)}</title>`,
    `  <desc id="${id}-desc">${esc(desc)}</desc>`,
    defs.length ? `  <defs>${defs.join('')}</defs>` : null,
    ...out.map(line => `  ${line}`),
    '</svg>',
    '',
  ].filter(line => line !== null).join('\n');
  if (Buffer.byteLength(svg) > 40 * 1024) throw new Error(`${id}: SVG is larger than 40 KB`);
  return svg;
}

const lanes = [
  { x: 86, title: 'client', sub: 'curl', hue: 'violet' },
  { x: 236, title: 'proxy cache', sub: 'reverse proxy', hue: 'blue' },
  { x: 386, title: 'cache store', sub: 'on disk', hue: 'teal' },
  { x: 546, title: 'origin', sub: 'api server', hue: 'grey' },
];
const rows = [
  [0, 1, 'call', 'GET /v1/models', null],
  [1, 3, 'call', 'GET /v1/models', 'nothing stored yet'],
  [3, 1, 'reply', '200 OK, ETag "v7"', null],
  [1, 2, 'write', 'body, ETag "v7"', null],
  [1, 0, 'reply', '200 OK', null],
  [0, 1, 'call', 'GET /v1/models', 'second request'],
  [1, 3, 'call', 'If-None-Match: "v7"', 'asks if v7 is current'],
  [3, 1, 'reply', '304 Not Modified', 'no body sent'],
];

const svg = figure('fig-1-1', {
  height: 420,
  title: 'A conditional request to a cached resource',
  desc: 'Four lifelines: client, proxy cache, cache store and origin. The first GET goes to the origin, which answers 200 with ETag v7, and the proxy writes the body to the store. The second GET sends If-None-Match v7 and the origin answers 304 Not Modified with no body.',
}, f => {
  for (const lane of lanes) {
    f.box({ x: lane.x, y: 8, w: 128, h: 40, hue: lane.hue, title: lane.title, sub: lane.sub, center: true });
    f.lifeline(lane.x, 48, 412);
  }
  rows.forEach(([from, to, style, label, note], index) => {
    const y = 84 + index * 44;
    f.step(16, y, index + 1);
    const x1 = lanes[from].x;
    const x2 = lanes[to].x;
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label, note });
  });
});

const target = process.argv[2];
if (target) writeFileSync(target, svg, 'utf8');
else process.stdout.write(svg);
