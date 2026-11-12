'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/validation-parallel-x86.json'));
const points = data.points;
const first = points[0];
const last = points[points.length - 1];
const total = points.reduce((sum, p) => sum + p.requests, 0);
const served = points.reduce((sum, p) => sum + p.ok, 0);
const two = value => (Math.round(value * 100) / 100).toFixed(2);
const more = Math.round((last.seconds.median / first.seconds.median - 1) * 100);
const medians = points.map(p => `${two(p.seconds.median)} s at ${p.x}`).join(', ');
const slots = data.workers_before.cpu_millicores_capacity / 1000;

module.exports = figure('fig-4-4b', {
  height: 352,
  title: 'Resume time against the number of resumes at the same instant',
  desc: `Seconds for one request to a suspended 50 MiB actor against the number of such requests sent at the same instant, on the x86 server guest with gVisor and a pool with room for ${slots} actors. Every one of the ${total} requests is a small dot, five rounds for each level, and a line joins the medians. ${served} of ${total} requests returned 200. The median is ${medians}. The slowest of the ${last.requests} requests at ${last.x} at once took ${two(last.seconds.max)} s. A dashed line marks 0.5 s.`,
}, f => {
  const c = chart(f, { x: 46, y: 40, w: 420, h: 270, xScale: 'log2', xDomain: [0.8, 20], yDomain: [0, 0.6], xTicks: points.map(p => p.x), yTicks: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6], xFormat: v => String(v), yFormat: v => v.toFixed(1), xLabel: 'resumes at the same instant, one request for each suspended actor', yLabel: 'seconds from request to reply, at the client' });

  f.rule(c.px(0.8), c.py(0.5), c.px(20), c.py(0.5), { hue: 'ink-soft', dash: 'dashed' });
  c.series(points.map(p => [p.x, p.seconds.median]), { hue: 'violet', dots: false });
  for (const p of points) {
    const sorted = [...p.runs].sort((a, b) => a - b);
    sorted.forEach((v, i) => f.dot(c.px(p.x) + ((i % 7) - 3) * 2.2, c.py(v), { hue: 'violet', r: 1.7 }));
    f.text(c.px(p.x), c.py(p.seconds.max) - 9, `${two(p.seconds.median)} s`, { size: 11, hue: 'violet', anchor: 'middle', weight: 700 });
    f.text(c.px(p.x), c.py(0.04), `${p.ok} of ${p.requests}`, { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });
  }

  const right = c.px(20) + 14;
  f.text(right, c.py(last.seconds.median) - 10, `${last.x} at once`, { size: 11.5, weight: 700, hue: 'violet' });
  f.text(right, c.py(last.seconds.median) + 5, `${two(last.seconds.median)} s median of ${last.seconds.n}`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(right, c.py(last.seconds.median) + 20, `${more} percent more than 1`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(right, c.py(last.seconds.median) + 35, `slowest ${two(last.seconds.max)} s`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(right, c.py(0.5) + 4, '0.5 s', { size: 11.5, weight: 700, hue: 'ink-soft' });
  f.text(right, c.py(0.04), 'returned 200, of sent', { size: 11, serif: true, hue: 'ink-soft' });

  f.dot(c.px(0.8) + 15, c.py(0.56) - 4, { hue: 'ink-soft', r: 1.7 });
  f.text(c.px(0.8) + 24, c.py(0.56), 'one request', { size: 11, serif: true, hue: 'ink-soft' });
  f.rule(c.px(0.8) + 112, c.py(0.56) - 4, c.px(0.8) + 130, c.py(0.56) - 4, { hue: 'ink-soft', width: 1.8 });
  f.text(c.px(0.8) + 136, c.py(0.56), 'median of one level', { size: 11, serif: true, hue: 'ink-soft' });
});
