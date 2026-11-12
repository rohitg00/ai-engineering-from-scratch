'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/lab/summary/suspend-x86.json'));
const fast = runs.async.points;
const slow = runs.sync.points;
const fastLast = fast[fast.length - 1];
const slowLast = slow[slow.length - 1];
const gap = slowLast.seconds.median - fastLast.seconds.median;
const total = [...fast, ...slow].reduce((sum, p) => sum + p.runs.length, 0);
const two = value => (Math.round(value * 100) / 100).toFixed(2);
const medians = points => points.map(p => `${two(p.seconds.median)} s at ${p.x} MiB`).join(', ');

module.exports = figure('fig-3-3b', {
  height: 352,
  title: 'What a synchronous suspend costs the caller',
  desc: `Seconds for kubectl ate suspend actor to return against the MiB of random memory the actor holds, on the x86 server guest. Every one of the ${total} suspends is a small dot, and a line joins the medians. The default asynchronous suspend returns when the snapshot is on the node, and its median is ${medians(fast)}, with ten suspends for each size. With --mode sync the command returns after the upload to the object store, and its median is ${medians(slow)}, with five suspends for each size. At 1000 MiB the synchronous suspend takes ${gap.toFixed(1)} s more.`,
}, f => {
  const c = chart(f, { x: 46, y: 40, w: 440, h: 270, xDomain: [0, 1000], yDomain: [0, 8], xTicks: [0, 50, 200, 500, 1000], yTicks: [0, 2, 4, 6, 8], xFormat: v => String(v), xLabel: 'memory the actor holds, MiB', yLabel: 'seconds until kubectl ate suspend actor returns' });
  const strip = (points, hue, dx) => {
    for (const p of points) {
      const x = c.px(p.x) + (p.x === 0 ? dx + 6 : dx);
      f.rule(x, c.py(p.seconds.max), x, c.py(p.seconds.min), { hue, opacity: 0.45 });
      for (const v of p.runs) f.dot(x, c.py(v), { hue, r: 1.9 });
    }
  };
  c.series(slow.map(p => [p.x, p.seconds.median]), { hue: 'teal', name: 'sync', dots: false });
  c.series(fast.map(p => [p.x, p.seconds.median]), { hue: 'violet', name: 'async', dots: false });
  strip(slow, 'teal', 4);
  strip(fast, 'violet', -4);

  const lx = c.px(1000) + 14;
  f.text(lx, c.py(slowLast.seconds.median) + 4, '--mode sync', { size: 11.5, weight: 700, hue: 'teal' });
  f.text(lx, c.py(slowLast.seconds.median) + 19, `${two(slowLast.seconds.median)} s median of ${slowLast.seconds.n}`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(lx, c.py(slowLast.seconds.median) + 33, 'after the upload', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(lx, c.py(fastLast.seconds.median) + 4, 'async, the default', { size: 11.5, weight: 700, hue: 'violet' });
  f.text(lx, c.py(fastLast.seconds.median) + 19, `${two(fastLast.seconds.median)} s median of ${fastLast.seconds.n}`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(lx, c.py(fastLast.seconds.median) + 33, 'snapshot on the node', { size: 11, serif: true, hue: 'ink-soft' });

  const bx = c.px(1000) - 22;
  f.path(`M${bx} ${c.py(fastLast.seconds.median) - 5} V${c.py(slowLast.seconds.median) + 5}`, { hue: 'ink-soft', both: true, width: 1, packet: false });
  f.text(bx - 8, c.py((slowLast.seconds.median + fastLast.seconds.median) / 2) + 4, `${gap.toFixed(1)} s more to wait`, { size: 11, serif: true, hue: 'ink-soft', anchor: 'end', knock: true });
  f.text(bx - 8, c.py((slowLast.seconds.median + fastLast.seconds.median) / 2) + 18, 'for the upload', { size: 11, serif: true, hue: 'ink-soft', anchor: 'end', knock: true });

  f.dot(c.px(20) + 3, c.py(7.4) - 4, { hue: 'ink-soft', r: 1.9 });
  f.text(c.px(20) + 12, c.py(7.4), 'one suspend', { size: 11, serif: true, hue: 'ink-soft' });
  f.rule(c.px(20) + 88, c.py(7.4) - 4, c.px(20) + 106, c.py(7.4) - 4, { hue: 'ink-soft', width: 1.8 });
  f.text(c.px(20) + 112, c.py(7.4), 'median of one size', { size: 11, serif: true, hue: 'ink-soft' });
});
