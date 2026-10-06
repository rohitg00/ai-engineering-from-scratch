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
const NEUTRALS = ['ink', 'ink-soft', 'ink-mute', 'panel', 'panel-edge', 'paper', 'accent', 'code-bg'];
const DASH = { solid: null, dashed: '5 4', dotted: '1.5 3.5' };
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

function readTokens(css = fs.readFileSync(path.join(__dirname, 'tokens.css'), 'utf8')) {
  const block = /:root\s*\{([\s\S]*?)\}/.exec(css);
  if (!block) throw new Error('tokens.css: :root block missing');
  const tokens = new Map();
  for (const match of block[1].matchAll(/--(m-[a-z-]+):\s*([^;]+);/g)) tokens.set(match[1], match[2].trim().toLowerCase());
  return tokens;
}

const TOKENS = readTokens();
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
    if (!this.title || !this.desc || this.desc.length < 40) throw new Error(`${id}: title and a desc of at least 40 characters are required`);
  }

  text(x, y, content, options = {}) {
    const size = options.size || 12;
    const anchor = options.anchor || 'start';
    const box = textBox(content, x, y, size, { serif: options.serif, spacing: options.spacing || 0, anchor });
    if (options.max && box.width > options.max) throw new Error(`${this.id}: "${content}" is ${Math.ceil(box.width)} wide, max ${options.max}`);
    if (box.left < 1 || box.right > WIDTH - 1) throw new Error(`${this.id}: "${content}" runs outside the figure`);
    if (/…|\.\.\./.test(content)) throw new Error(`${this.id}: no ellipsis in labels ("${content}")`);
    if (size < MIN_FONT) throw new Error(`${this.id}: font-size ${size} is below ${MIN_FONT}`);
    if (options.knock) this.parts.push(`<rect${attrs({ class: 'm-knock', x: box.left - 3, y: box.top - 2, width: box.width + 6, height: size + 4, fill: color('panel') })}/>`);
    this.parts.push(`<text${attrs({
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
    this.parts.push(`<rect${attrs({
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
    this.parts.push(`<rect${attrs({ x, y, width: w, height: h, fill: `url(#${this.id}-hatch)`, stroke: color('ink-mute'), 'stroke-opacity': 0.35 })}/>`);
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
    this.parts.push(`<${tag}${attrs({
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
    return this;
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
    this.parts.push(`<circle${attrs({ cx: x, cy: y, r: 9, fill: color('paper'), stroke: inkOf(options.hue || 'ink'), 'stroke-width': 1 })}/>`);
    this.text(x, y + 4, String(n), { size: 11, anchor: 'middle', hue: options.hue && options.hue !== 'ink' ? options.hue : undefined });
    return this;
  }

  lifeline(x, y1, y2) {
    this.parts.push(`<line${attrs({ x1: x, y1, x2: x, y2, stroke: color('ink-mute'), 'stroke-width': 1, 'stroke-dasharray': '2 3' })}/>`);
    return this;
  }

  rule(x1, y1, x2, y2, options = {}) {
    this.parts.push(`<line${attrs({ x1, y1, x2, y2, stroke: inkOf(options.hue || 'ink-mute'), 'stroke-width': options.width || 1, 'stroke-dasharray': options.dash ? DASH[options.dash] : undefined, 'stroke-opacity': options.opacity })}/>`);
    return this;
  }

  dot(x, y, options = {}) {
    this.parts.push(`<circle${attrs({ cx: x, cy: y, r: options.r || 2.5, fill: inkOf(options.hue || 'ink') })}/>`);
    return this;
  }

  marker(hue) {
    this.markers.add(hue);
    return `${this.id}-head-${hue}`;
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
      ...this.parts.map(part => `  ${part}`),
      '</svg>',
      '',
    ].filter(line => line !== null).join('\n');
  }
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

module.exports = { ASCENT, DASH, DESCENT, HUES, MIN_FONT, MONO, SERIF, STYLES, TOKENS, WIDTH, Figure, build, color, escapeHtml, figure, measure, readTokens, sources, textBox };
