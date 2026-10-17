'use strict';

const { color, escapeHtml } = require('./figkit.js');

const SCALES = {
  linear: { f: v => v, inv: v => v },
  log2: { f: v => Math.log2(v), inv: v => 2 ** v },
  log10: { f: v => Math.log10(v), inv: v => 10 ** v },
};

function fmt(value) {
  if (Math.abs(value) >= 1000) return `${Math.round(value / 100) / 10}k`.replace('.0k', 'k');
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 100) / 100);
}

function chart(f, options) {
  const { x, y, w, h } = options;
  const xs = SCALES[options.xScale || 'linear'];
  const ys = SCALES[options.yScale || 'linear'];
  const [x0, x1] = options.xDomain.map(xs.f);
  const [y0, y1] = options.yDomain.map(ys.f);
  if (!(x1 > x0) || !(y1 > y0)) throw new Error(`${f.id}: chart domain must be increasing`);
  const px = v => x + ((xs.f(v) - x0) / (x1 - x0)) * w;
  const py = v => y + h - ((ys.f(v) - y0) / (y1 - y0)) * h;
  const inside = (vx, vy) => xs.f(vx) >= x0 - 1e-9 && xs.f(vx) <= x1 + 1e-9 && ys.f(vy) >= y0 - 1e-9 && ys.f(vy) <= y1 + 1e-9;
  const xFormat = options.xFormat || fmt;
  const yFormat = options.yFormat || fmt;

  for (const t of options.yTicks || []) {
    f.rule(x, py(t), x + w, py(t), { hue: 'ink-mute', opacity: 0.25 });
    f.text(x - 6, py(t) + 4, yFormat(t), { size: 11, anchor: 'end', hue: 'ink-soft' });
  }
  f.rule(x, y + h, x + w, y + h, { hue: 'ink' });
  f.rule(x, y, x, y + h, { hue: 'ink' });
  for (const t of options.xTicks || []) {
    f.rule(px(t), y + h, px(t), y + h + 4, { hue: 'ink' });
    f.text(px(t), y + h + 17, xFormat(t), { size: 11, anchor: 'middle', hue: 'ink-soft' });
  }
  if (options.xLabel) f.text(x + w / 2, y + h + 34, options.xLabel, { size: 11.5, anchor: 'middle', serif: true, hue: 'ink-soft' });
  if (options.yLabel) f.text(x, y - 12, options.yLabel, { size: 11.5, serif: true, hue: 'ink-soft' });

  const api = {
    px,
    py,
    series(points, opts = {}) {
      const kept = points.filter(([vx, vy]) => inside(vx, vy));
      if (kept.length !== points.length) throw new Error(`${f.id}: a point of series ${opts.name || ''} is outside the chart domain`);
      const d = kept.map(([vx, vy], i) => `${i ? 'L' : 'M'}${px(vx).toFixed(1)} ${py(vy).toFixed(1)}`).join(' ');
      if (kept.length > 1) f.path(d, { hue: opts.hue || 'blue', dash: opts.dash || 'solid', head: false, width: opts.width || 1.8, packet: false });
      if (opts.dots !== false) for (const [vx, vy] of kept) f.dot(px(vx), py(vy), { hue: opts.hue || 'blue', r: opts.r || 2.8 });
      return api;
    },
    band(lower, upper, opts = {}) {
      const top = upper.map(([vx, vy]) => [px(vx), py(vy)]);
      const bottom = lower.map(([vx, vy]) => [px(vx), py(vy)]).reverse();
      const d = [...top, ...bottom].map(([a, b], i) => `${i ? 'L' : 'M'}${a.toFixed(1)} ${b.toFixed(1)}`).join(' ') + ' Z';
      f.emit(`<path d="${d}" fill="${color(`${opts.hue || 'blue'}-ink`)}" fill-opacity="${opts.opacity || 0.14}" stroke="none"/>`);
      return api;
    },
    step(points, opts = {}) {
      const d = points.map(([vx, vy], i) => (i ? `H${px(vx).toFixed(1)} V${py(vy).toFixed(1)}` : `M${px(vx).toFixed(1)} ${py(vy).toFixed(1)}`)).join(' ');
      f.path(d, { hue: opts.hue || 'blue', dash: opts.dash || 'solid', head: false, width: opts.width || 1.6, packet: false });
      return api;
    },
    bars(items, opts = {}) {
      const slot = w / items.length;
      const width = Math.min(opts.width || slot * 0.55, slot - 6);
      items.forEach((item, i) => {
        const cx = x + slot * (i + 0.5);
        const top = py(item.value);
        f.rect(cx - width / 2, top, width, y + h - top, { fill: color(`${item.hue || 'blue'}-fill`), stroke: color(`${item.hue || 'blue'}-ink`) });
        f.text(cx, top - 6, item.label || yFormat(item.value), { size: 11, anchor: 'middle', hue: item.hue || 'ink' });
        f.text(cx, y + h + 17, item.name, { size: 11, anchor: 'middle', hue: 'ink-soft' });
      });
      return api;
    },
    note(vx, vy, content, opts = {}) {
      f.text(px(vx) + (opts.dx || 0), py(vy) + (opts.dy || 0), content, { size: 11, hue: opts.hue || 'ink-soft', anchor: opts.anchor || 'start', serif: opts.serif !== false, knock: opts.knock });
      return api;
    },
  };
  return api;
}

function legend(f, items, x, y, opts = {}) {
  let cx = x;
  for (const item of items) {
    f.path(`M${cx} ${y - 4} H${cx + 18}`, { hue: item.hue, dash: item.dash || 'solid', head: false, width: 2, packet: false });
    const box = f.text(cx + 24, y, item.name, { size: 11, hue: item.hue });
    cx = box.right + (opts.gap || 18);
  }
}

function load(file) {
  return JSON.parse(require('fs').readFileSync(file, 'utf8'));
}

module.exports = { chart, legend, load, fmt, escapeHtml };
