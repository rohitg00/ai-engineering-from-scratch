#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const WIDTH = 640;
const MIN_FONT = 11;
const MONO = 0.6;
const SERIF = 0.54;
const ASCENT = 0.78;
const DESCENT = 0.22;
const NEUTRALS = ['ink', 'ink-soft', 'ink-mute', 'panel', 'panel-edge', 'paper', 'accent', 'code-bg', 'shine', 'shade'];
const DASH = { solid: null, dashed: '5 4', dotted: '1.5 3.5' };
const STEP = 0.6;
const FADE = 0.45;
const MOVE = 0.55;
const EASE = '0 0 1 1;0.23 1 0.32 1';
const STYLES = {
  call: { hue: 'ink', dash: 'solid' },
  reply: { hue: 'ink', dash: 'dashed' },
  write: { hue: 'teal', dash: 'solid' },
  state: { hue: 'amber', dash: 'dashed' },
  model: { hue: 'plum', dash: 'solid' },
  effect: { hue: 'olive', dash: 'dashed' },
  event: { hue: 'indigo', dash: 'dotted' },
  fail: { hue: 'rose', dash: 'dashed' },
};

const ISO = {
  true: { ax: 0.8660254, ay: 0.5 },
  plate: { ax: 0.9761871, ay: 0.2169305 },
};
const TONE = { shine: 0.45, shade: 0.16 };
const SHADOW = { reach: 0.6, max: 22, dx: 1, dy: -0.35, opacity: 0.12 };

function hull(points) {
  const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = list => {
    const out = [];
    for (const point of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], point) <= 0) out.pop();
      out.push(point);
    }
    out.pop();
    return out;
  };
  return half(sorted).concat(half(sorted.slice().reverse()));
}

const ROOT_BLOCK =/:root\s*\{([\s\S]*?)\}/.exec(fs.readFileSync(path.join(__dirname, 'tokens.css'), 'utf8'));
if (!ROOT_BLOCK) throw new Error('tokens.css: :root block missing');
const TOKENS = new Map([...ROOT_BLOCK[1].matchAll(/--(m-[a-z-]+):\s*([^;]+);/g)].map(match => [match[1], match[2].trim().toLowerCase()]));
const HUES = [...TOKENS.keys()].map(name => /^m-([a-z]+)-ink$/.exec(name)).filter(Boolean).map(match => match[1]).filter(hue => TOKENS.has(`m-${hue}-fill`));

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function color(name) {
  const value = TOKENS.get(`m-${name}`);
  if (!value || !/^#[0-9a-f]{6}$/.test(value)) throw new Error(`figkit: --m-${name} is not a hex colour token`);
  return `var(--m-${name}, ${value})`;
}
function inkOf(hue) { return NEUTRALS.includes(hue) ? color(hue) : color(`${hue}-ink`); }
function fillOf(hue) { return NEUTRALS.includes(hue) ? color(hue) : color(`${hue}-fill`); }
function num(value) { return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100); }
function fraction(value, total) { return String(Math.round((value / total) * 1000) / 1000); }
function pointList(points) { return points.map(([x, y]) => `${num(x)},${num(y)}`).join(' '); }
function attrs(map) { return Object.entries(map).filter(([, v]) => v !== undefined && v !== null && v !== false).map(([k, v]) => ` ${k}="${typeof v === 'number' ? num(v) : escapeHtml(v)}"`).join(''); }

function measure(text, size, serif = false, spacing = 0) {
  const chars = Array.from(String(text)).length;
  return chars * size * (serif ? SERIF : MONO) + Math.max(0, chars - 1) * spacing;
}

function textBox(text, x, y, size, { serif = false, spacing = 0, anchor = 'start' } = {}) {
  const width = measure(text, size, serif, spacing);
  const left = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
  return { left, right: left + width, width, top: y - ASCENT * size, bottom: y + DESCENT * size };
}

class Figure {
  constructor(id, options) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error(`figkit: bad id ${id}`);
    this.id = id;
    this.height = options.height;
    this.title = options.title;
    this.desc = options.desc;
    this.parts = [];
    this.markers = new Set();
    this.hatch = false;
    this.current = 0;
    if (!this.title || !this.desc || this.desc.length < 40) throw new Error(`${id}: title and a desc of at least 40 characters are required`);
  }

  emit(svg) {
    this.parts.push({ beat: this.current, svg });
  }

  beat(n) {
    if (!Number.isInteger(n) || n < 0 || n > 40) throw new Error(`${this.id}: beat must be an integer from 0 to 40`);
    this.current = n;
    return this;
  }

  text(x, y, content, options = {}) {
    const size = options.size || 12;
    const anchor = options.anchor || 'start';
    const box = textBox(content, x, y, size, { serif: options.serif, spacing: options.spacing || 0, anchor });
    if (options.max && box.width > options.max) throw new Error(`${this.id}: "${content}" is ${Math.ceil(box.width)} wide, max ${options.max}`);
    if (box.left < 1 || box.right > WIDTH - 1) throw new Error(`${this.id}: "${content}" runs outside the figure`);
    if (/…|\.\.\./.test(content)) throw new Error(`${this.id}: no ellipsis in labels ("${content}")`);
    if (size < MIN_FONT) throw new Error(`${this.id}: font-size ${size} is below ${MIN_FONT}`);
    if (options.knock) this.emit(`<rect${attrs({ class: 'm-knock', x: box.left - 3, y: box.top - 2, width: box.width + 6, height: size + 4, fill: color('panel') })}/>`);
    this.emit(`<text${attrs({
      x, y,
      'font-size': size,
      'text-anchor': anchor === 'start' ? undefined : anchor,
      'font-weight': options.weight,
      'letter-spacing': options.spacing,
      'font-style': options.italic ? 'italic' : undefined,
      class: options.serif ? 'm-serif' : undefined,
      fill: options.hue ? inkOf(options.hue) : undefined,
    })}>${escapeHtml(content)}</text>`);
    return box;
  }

  kicker(x, y, content, options = {}) {
    return this.text(x, y, String(content).toUpperCase(), { size: 11, spacing: 1.2, hue: options.hue || 'ink-mute', anchor: options.anchor, weight: options.weight });
  }

  rect(x, y, w, h, options = {}) {
    this.emit(`<rect${attrs({
      x, y, width: w, height: h,
      fill: options.fill || (options.hue ? fillOf(options.hue) : 'none'),
      stroke: options.stroke === 'none' ? undefined : options.stroke || (options.hue ? inkOf(options.hue) : undefined),
      'stroke-width': options.strokeWidth,
      'stroke-dasharray': options.dash ? DASH[options.dash] : undefined,
    })}/>`);
    return { x, y, w, h };
  }

  hatchRect(x, y, w, h) {
    this.hatch = true;
    this.emit(`<rect${attrs({ x, y, width: w, height: h, fill: `url(#${this.id}-hatch)`, stroke: color('ink-mute'), 'stroke-opacity': 0.35 })}/>`);
    return { x, y, w, h };
  }

  box(options) {
    const titleSize = options.titleSize || 12.5;
    const subSize = options.subSize || 11;
    const pad = options.pad === undefined ? 12 : options.pad;
    const lines = [].concat(options.sub || []);
    const titleWidth = options.title ? measure(options.title, titleSize) : 0;
    const subWidth = Math.max(0, ...lines.map(line => measure(line, subSize, true)));
    const w = options.w || Math.ceil(Math.max(titleWidth, subWidth) + pad * 2);
    const lineHeight = subSize + 4;
    const h = options.h || Math.ceil((options.title ? titleSize + 6 : 0) + lines.length * lineHeight + 16);
    const x = options.anchor === 'middle' ? options.x - w / 2 : options.x;
    const y = options.y;
    this.rect(x, y, w, h, { hue: options.hue || 'grey', dash: options.dash, strokeWidth: options.strokeWidth });
    if (options.double) this.rect(x + 3, y + 3, w - 6, h - 6, { fill: 'none', stroke: inkOf(options.hue || 'grey') });
    const cx = options.align === 'left' ? x + pad : x + w / 2;
    const anchor = options.align === 'left' ? 'start' : 'middle';
    const inner = w - pad * 2;
    const blockHeight = (options.title ? titleSize : 0) + lines.length * lineHeight + (options.title && lines.length ? 2 : 0);
    let cursor = y + (h - blockHeight) / 2 + (options.title ? titleSize : subSize) * 0.8;
    if (options.title) {
      this.text(cx, cursor, options.title, { size: titleSize, weight: options.weight === undefined ? 700 : options.weight, anchor, max: inner, hue: options.titleHue });
      cursor += titleSize * 0.2 + 4 + subSize * 0.8 + 2;
    }
    for (const line of lines) {
      this.text(cx, cursor, line, { size: subSize, serif: true, hue: 'ink-soft', anchor, max: inner });
      cursor += lineHeight;
    }
    return anchorsOf(x, y, w, h);
  }

  stroke(tag, geometry, options) {
    const style = resolveStyle(options);
    const marker = options.head === false ? undefined : this.marker(style.hue);
    this.emit(`<${tag}${attrs({
      ...geometry,
      fill: tag === 'path' ? 'none' : undefined,
      stroke: inkOf(style.hue),
      'stroke-width': options.width || 1.2,
      'stroke-dasharray': DASH[style.dash] || undefined,
      'stroke-linecap': style.dash === 'dotted' ? 'round' : undefined,
      'stroke-linejoin': tag === 'path' ? 'round' : undefined,
      'marker-end': marker ? `url(#${marker})` : undefined,
      'marker-start': options.both && marker ? `url(#${marker})` : undefined,
    })}/>`);
    if (this.current && marker && options.packet !== false) this.packet(tag, geometry, style.hue);
    return this;
  }

  packet(tag, geometry, hue) {
    const d = tag === 'path' ? geometry.d : `M${num(geometry.x1)} ${num(geometry.y1)} L${num(geometry.x2)} ${num(geometry.y2)}`;
    const length = MOVE + 0.25;
    const motion = timing(this.current, length, [0, MOVE], { calcMode: 'linear' });
    const opacity = timing(this.current, length, [0, 0.08, MOVE]);
    this.emit(`<circle${attrs({ class: 'm-packet', r: 3.5, fill: inkOf(hue), opacity: 0 })}><animateMotion${attrs({ path: d, keyPoints: '0;0;1;1', ...motion })}/><animate${attrs({ attributeName: 'opacity', values: '0;0;1;1;0', ...opacity })}/></circle>`);
  }

  line(x1, y1, x2, y2, options = {}) { return this.stroke('line', { x1, y1, x2, y2 }, options); }

  path(d, options = {}) { return this.stroke('path', { d }, options); }

  arrow(from, to, options = {}) {
    this.line(from[0], from[1], to[0], to[1], options);
    const style = resolveStyle(options);
    const horizontal = Math.abs(to[1] - from[1]) < 1;
    const x = horizontal ? (options.labelX !== undefined ? options.labelX : (from[0] + to[0]) / 2) : from[0] + 8;
    const my = (from[1] + to[1]) / 2;
    const anchor = horizontal ? 'middle' : 'start';
    const knock = options.knock !== false;
    if (options.label) this.text(x, horizontal ? my - 6 : my, options.label, { size: options.labelSize || 11.5, hue: style.hue === 'ink' ? undefined : style.hue, anchor, weight: options.bold ? 700 : undefined, knock });
    if (options.note) this.text(x, my + 15, options.note, { size: 11, serif: true, hue: 'ink-soft', anchor, knock });
    return this;
  }

  step(x, y, n, options = {}) {
    this.emit(`<circle${attrs({ cx: x, cy: y, r: 9, fill: color('paper'), stroke: inkOf(options.hue || 'ink'), 'stroke-width': 1 })}/>`);
    this.text(x, y + 4, String(n), { size: 11, anchor: 'middle', hue: options.hue && options.hue !== 'ink' ? options.hue : undefined });
    return this;
  }

  lifeline(x, y1, y2) {
    this.emit(`<line${attrs({ x1: x, y1, x2: x, y2, stroke: color('ink-mute'), 'stroke-width': 1, 'stroke-dasharray': '2 3' })}/>`);
    return this;
  }

  rule(x1, y1, x2, y2, options = {}) {
    this.emit(`<line${attrs({ x1, y1, x2, y2, stroke: inkOf(options.hue || 'ink-mute'), 'stroke-width': options.width || 1, 'stroke-dasharray': options.dash ? DASH[options.dash] : undefined, 'stroke-opacity': options.opacity })}/>`);
    return this;
  }

  dot(x, y, options = {}) {
    this.emit(`<circle${attrs({ cx: x, cy: y, r: options.r || 2.5, fill: inkOf(options.hue || 'ink') })}/>`);
    return this;
  }

  isoView({ ox, oy, s = 1, angle = 'plate' }) {
    const m = ISO[angle];
    if (!m) throw new Error(`${this.id}: unknown iso angle ${angle}`);
    const P = (x, y, z = 0) => [ox + (x - y) * m.ax * s, oy + (x + y) * m.ay * s - z * s];
    const at = (sx, c) => {
      const diff = (sx - ox) / (m.ax * s);
      return [(diff + c) / 2, (c - diff) / 2];
    };
    return { P, at, s, angle };
  }

  polygon(points, options) {
    this.emit(`<polygon${attrs({
      points: pointList(points),
      fill: options.fill || 'none',
      'fill-opacity': options.fillOpacity,
      stroke: options.stroke,
      'stroke-width': options.strokeWidth,
      'stroke-opacity': options.strokeOpacity,
      'stroke-linejoin': options.stroke ? 'round' : undefined,
      'stroke-dasharray': options.dash ? DASH[options.dash] : undefined,
    })}/>`);
  }

  isoBlock(view, options) {
    const { P } = view;
    const { x, y, w, d, h } = options;
    const z = options.z || 0;
    const hue = options.hue || 'grey';
    const x1 = x + w;
    const y1 = y + d;
    const z1 = z + h;
    const top = [P(x, y, z1), P(x1, y, z1), P(x1, y1, z1), P(x, y1, z1)];
    const end = [P(x1, y, z), P(x1, y1, z), P(x1, y1, z1), P(x1, y, z1)];
    const front = [P(x, y1, z), P(x1, y1, z), P(x1, y1, z1), P(x, y1, z1)];
    const outline = [P(x, y, z1), P(x1, y, z1), P(x1, y, z), P(x1, y1, z), P(x, y1, z), P(x, y1, z1)];
    if (options.shadow !== false && h > 0) this.isoShadow(view, { x, y, w, d, h, z });
    const ink = inkOf(options.inkHue || hue);
    const fill = fillOf(hue);
    this.polygon(outline, { fill: color('panel') });
    for (const [face, tone] of [[top, 'shine'], [front, null], [end, 'shade']]) {
      this.polygon(face, { fill });
      if (tone) this.polygon(face, { fill: color(tone), fillOpacity: TONE[tone] });
    }
    const near = P(x1, y1, z1);
    if (options.edges !== false) for (const far of [P(x1, y, z1), P(x, y1, z1), P(x1, y1, z)]) {
      this.emit(`<polyline${attrs({ points: pointList([near, far]), fill: 'none', stroke: ink, 'stroke-width': 0.8, 'stroke-opacity': 0.6 })}/>`);
    }
    this.polygon(outline, { stroke: ink, strokeWidth: options.ink || 1.5, dash: options.dash });
    return { top: P(x + w / 2, y + d / 2, z1), near, outline, box: { x, y, z, w, d, h }, P: (u, v, k) => P(x + u, y + v, z + k) };
  }

  isoBeam(view, options) {
    const { P, at } = view;
    const { sx0, sx1, c, back, h } = options;
    const z = options.z || 0;
    const hue = options.hue || 'grey';
    const [ax0, ay0] = at(sx0, c);
    const [ax1, ay1] = at(sx1, c);
    const [bx0, by0] = at(sx0, c - back);
    const [bx1, by1] = at(sx1, c - back);
    const front = [P(ax0, ay0, z), P(ax1, ay1, z), P(ax1, ay1, z + h), P(ax0, ay0, z + h)];
    const top = [P(ax0, ay0, z + h), P(ax1, ay1, z + h), P(bx1, by1, z + h), P(bx0, by0, z + h)];
    const outline = [front[0], front[1], front[2], top[2], top[3], front[3]];
    const fill = fillOf(hue);
    const ink = inkOf(options.inkHue || hue);
    if (options.shadow !== false) {
      const drop = h * SHADOW.reach;
      this.polygon([front[0], front[1], [front[1][0] + drop, front[1][1] + drop * 0.25], [front[0][0] + drop, front[0][1] + drop * 0.25]], { fill: color('accent'), fillOpacity: SHADOW.opacity });
    }
    this.polygon(outline, { fill: color('panel') });
    this.polygon(front, { fill });
    this.polygon(top, { fill });
    this.polygon(top, { fill: color('shine'), fillOpacity: TONE.shine });
    this.emit(`<polyline${attrs({ points: pointList([front[3], front[2]]), fill: 'none', stroke: ink, 'stroke-width': 0.8, 'stroke-opacity': 0.6 })}/>`);
    this.polygon(outline, { stroke: ink, strokeWidth: options.ink || 1.4, dash: options.dash });
    return { front, top, left: front[3], right: front[2] };
  }

  isoDrum(view, options) {
    const { P } = view;
    const m = ISO[view.angle];
    const { x, y, r, h } = options;
    const z = options.z || 0;
    const hue = options.hue || 'grey';
    const rx = r * Math.SQRT2 * m.ax * view.s;
    const ry = r * Math.SQRT2 * m.ay * view.s;
    const [tx, ty] = P(x, y, z + h);
    const [bx, by] = P(x, y, z);
    const ink = inkOf(options.inkHue || hue);
    const fill = fillOf(hue);
    const width = options.ink || 1.4;
    const side = [[tx - rx, ty]];
    for (let i = 0; i <= 16; i += 1) {
      const a = Math.PI - (Math.PI * i) / 16;
      side.push([bx + rx * Math.cos(a), by + ry * Math.sin(a)]);
    }
    side.push([tx + rx, ty]);
    this.polygon(side, { fill });
    this.polygon(side, { fill: color('shade'), fillOpacity: TONE.shade / 2 });
    this.polygon(side, { stroke: ink, strokeWidth: width });
    this.emit(`<ellipse${attrs({ cx: tx, cy: ty, rx, ry, fill })}/>`);
    this.emit(`<ellipse${attrs({ cx: tx, cy: ty, rx, ry, fill: color('shine'), 'fill-opacity': TONE.shine, stroke: ink, 'stroke-width': width })}/>`);
    return { top: [tx, ty - ry], center: [tx, ty] };
  }

  isoShadow(view, { x, y, w, d, h, z = 0 }) {
    const { P } = view;
    const reach = Math.min(h * SHADOW.reach, SHADOW.max);
    const corners = [];
    for (const [px, py] of [[x, y], [x + w, y], [x + w, y + d], [x, y + d]]) {
      corners.push(P(px, py, z), P(px + reach * SHADOW.dx, py + reach * SHADOW.dy, z));
    }
    this.polygon(hull(corners), { fill: color('accent'), fillOpacity: SHADOW.opacity });
  }

  isoBoard(view, options) {
    return this.isoBlock(view, { ...options, hue: 'paper', inkHue: 'ink-mute', shadow: false, ink: 1 });
  }

  isoFlow(view, points, options = {}) {
    const d = points.map((point, index) => {
      const [px, py] = view.P(...point);
      return `${index ? 'L' : 'M'}${num(px)} ${num(py)}`;
    }).join(' ');
    return this.path(d, options);
  }

  leader(from, to, options = {}) {
    const ink = inkOf(options.hue || 'ink-mute');
    this.emit(`<polyline${attrs({ points: pointList([from, to]), fill: 'none', stroke: ink, 'stroke-width': 0.8, 'stroke-dasharray': '2 3' })}/>`);
    this.emit(`<circle${attrs({ cx: to[0], cy: to[1], r: 2, fill: ink })}/>`);
    return this;
  }

  marker(hue) {
    this.markers.add(hue);
    return `${this.id}-head-${hue}`;
  }

  body() {
    const lines = [];
    let open = 0;
    for (const part of this.parts) {
      if (part.beat !== open) {
        if (open) lines.push('</g>');
        if (part.beat) lines.push(beatOpen(part.beat));
        open = part.beat;
      }
      lines.push(part.svg);
    }
    if (open) lines.push('</g>');
    return lines;
  }

  toString() {
    const defs = [];
    for (const hue of this.markers) defs.push(`<marker id="${this.id}-head-${hue}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 1 L10 5 L0 9 z" fill="${inkOf(hue)}"/></marker>`);
    if (this.hatch) defs.push(`<pattern id="${this.id}-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="${color('ink-mute')}" stroke-width="1" stroke-opacity="0.4"/></pattern>`);
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${this.height}" role="img" aria-labelledby="${this.id}-title ${this.id}-desc" font-family="JetBrains Mono, ui-monospace, monospace">`,
      `  <title id="${this.id}-title">${escapeHtml(this.title)}</title>`,
      `  <desc id="${this.id}-desc">${escapeHtml(this.desc)}</desc>`,
      defs.length ? `  <defs>${defs.join('')}</defs>` : null,
      ...this.body().map(line => `  ${line}`),
      '</svg>',
      '',
    ].filter(line => line !== null).join('\n');
  }
}

function timing(beat, length, marks, extra = {}) {
  const start = (beat - 1) * STEP;
  const total = start + length;
  return { keyTimes: ['0', ...marks.map(mark => fraction(start + mark, total)), '1'].join(';'), ...extra, dur: `${num(total)}s`, begin: 'indefinite', fill: 'freeze' };
}

function beatOpen(beat) {
  const fade = timing(beat, FADE, [0], { calcMode: 'spline', keySplines: EASE });
  return `<g data-beat="${beat}"><animate${attrs({ attributeName: 'opacity', values: '0;0;1', ...fade })}/><animateTransform${attrs({ attributeName: 'transform', type: 'translate', values: '0 4;0 4;0 0', ...fade })}/>`;
}

function resolveStyle(options) {
  const base = STYLES[options.style || 'call'];
  if (!base) throw new Error(`figkit: unknown arrow style ${options.style}`);
  const hue = options.hue || base.hue;
  if (!HUES.includes(hue) && !NEUTRALS.includes(hue)) throw new Error(`figkit: unknown hue ${hue}`);
  return { hue, dash: options.dash || base.dash };
}

function anchorsOf(x, y, w, h) {
  return {
    x, y, w, h,
    cx: x + w / 2,
    cy: y + h / 2,
    top: (dx = w / 2) => [x + dx, y],
    bottom: (dx = w / 2) => [x + dx, y + h],
    left: (dy = h / 2) => [x, y + dy],
    right: (dy = h / 2) => [x + w, y + dy],
  };
}

function figure(id, options, draw) {
  const fig = new Figure(id, options);
  draw(fig);
  return fig.toString();
}

function sources(dir) {
  const src = path.join(dir, 'figures', 'src');
  if (!fs.existsSync(src)) return [];
  return fs.readdirSync(src).filter(name => name.endsWith('.js')).sort().map(name => ({ id: name.replace(/\.js$/, ''), file: path.join(src, name) }));
}

function render(file) {
  delete require.cache[require.resolve(file)];
  const output = require(file);
  if (typeof output !== 'string' || !output.startsWith('<svg')) throw new Error(`${file}: module must export the SVG string from figure()`);
  return output;
}

function build(dir, check = false) {
  const drift = [];
  for (const { id, file } of sources(dir)) {
    const svg = render(file);
    const target = path.join(dir, 'figures', `${id}.svg`);
    const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
    if (current === svg) continue;
    if (check) drift.push(id);
    else fs.writeFileSync(target, svg, 'utf8');
  }
  return drift;
}

module.exports = { HUES, MIN_FONT, TOKENS, WIDTH, build, color, escapeHtml, figure, measure, textBox };

if (require.main === module) {
  const [command, dir] = process.argv.slice(2);
  if (!['build', 'check'].includes(command) || !dir) {
    console.error('usage: node manuals/_shared/figkit.js build|check <manual-dir>');
    process.exit(2);
  }
  try {
    const drift = build(path.resolve(dir), command === 'check');
    if (drift.length) {
      console.error(`figures out of date with figures/src: ${drift.join(', ')}. Run: node manuals/_shared/figkit.js build ${dir}`);
      process.exit(1);
    }
    console.log(`figkit ${command}: ${sources(path.resolve(dir)).length} figure source(s) ok`);
  } catch (error) {
    console.error(`figkit: ${error.message}`);
    process.exit(1);
  }
}

