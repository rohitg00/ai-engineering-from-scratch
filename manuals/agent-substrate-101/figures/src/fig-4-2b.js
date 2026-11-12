'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const summary = name => load(path.join(__dirname, '../../capture/lab/summary', name));
const sizes = [0, 200, 500];
const micro = summary('microvm-x86.json').node_local.points.filter(p => sizes.includes(p.x));
const gvisor = summary('resume-x86.json').node_local.points.filter(p => sizes.includes(p.x));
const at = (points, x) => points.find(p => p.x === x);
const two = value => (Math.round(value * 100) / 100).toFixed(2);
const slope = points => (at(points, 500).seconds.median - at(points, 0).seconds.median) / 500 * 1000;
const medians = points => points.map(p => `${two(p.seconds.median)} s at ${p.x} MiB`).join(', ');
const total = [...micro, ...gvisor].reduce((sum, p) => sum + p.runs.length, 0);
const fixed = at(micro, 0).seconds.median - at(gvisor, 0).seconds.median;

module.exports = figure('fig-4-2b', {
  height: 352,
  title: 'Resume time against memory held, for both sandbox classes',
  desc: `Seconds for one request to a suspended actor against the MiB of random memory it holds, on the x86 server guest, from the snapshot on the node. Every one of the ${total} resumes is a small dot, ten for each size and class, and a line joins the medians. The microvm class has a median of ${medians(micro)}. The gvisor class has a median of ${medians(gvisor)}. The microvm line starts ${two(fixed)} s higher and rises about half as fast, so the two lines cross a little above 200 MiB.`,
}, f => {
  const c = chart(f, { x: 46, y: 40, w: 430, h: 270, xDomain: [0, 500], yDomain: [0, 1.4], xTicks: [0, 100, 200, 300, 400, 500], yTicks: [0, 0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4], xFormat: v => String(v), yFormat: v => v.toFixed(1), xLabel: 'memory the actor holds, MiB', yLabel: 'seconds from request to reply, at the client' });
  const strip = (points, hue, dx) => {
    for (const p of points) {
      const x = c.px(p.x) + (p.x === 0 ? dx + 11 : dx);
      f.rule(x, c.py(p.seconds.max), x, c.py(p.seconds.min), { hue, opacity: 0.45 });
      for (const v of p.runs) f.dot(x, c.py(v), { hue, r: 1.9 });
    }
  };

  c.series(gvisor.map(p => [p.x, p.seconds.median]), { hue: 'ink-soft', dash: 'dashed', dots: false });
  c.series(micro.map(p => [p.x, p.seconds.median]), { hue: 'violet', dots: false });
  strip(gvisor, 'ink-soft', -5);
  strip(micro, 'violet', 5);

  const right = c.px(500) + 16;
  const g500 = at(gvisor, 500).seconds;
  const m500 = at(micro, 500).seconds;
  f.text(right, c.py(g500.median) - 10, 'gvisor', { size: 11.5, weight: 700, hue: 'ink-soft' });
  f.text(right, c.py(g500.median) + 5, `${two(g500.median)} s median of ${g500.n}`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(right, c.py(g500.median) + 20, `about ${slope(gvisor).toFixed(1)} ms per MiB`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(right, c.py(m500.median) + 4, 'microvm', { size: 11.5, weight: 700, hue: 'violet' });
  f.text(right, c.py(m500.median) + 19, `${two(m500.median)} s median of ${m500.n}`, { size: 11, serif: true, hue: 'violet' });
  f.text(right, c.py(m500.median) + 34, `about ${slope(micro).toFixed(1)} ms per MiB`, { size: 11, serif: true, hue: 'violet' });

  f.text(c.px(0) + 24, c.py(0.5) + 4, `microvm ${two(at(micro, 0).seconds.median)} s`, { size: 11, serif: true, hue: 'violet' });
  f.text(c.px(0) + 24, c.py(0.1) + 4, `gvisor ${two(at(gvisor, 0).seconds.median)} s`, { size: 11, serif: true, hue: 'ink-soft' });

  f.text(c.px(215), c.py(0.3) - 3, `at 200 MiB: ${two(at(micro, 200).seconds.median)} s and ${two(at(gvisor, 200).seconds.median)} s`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(c.px(215), c.py(0.3) + 11, 'the medians cross above this size', { size: 11, serif: true, hue: 'ink-soft' });

  f.dot(c.px(15) + 3, c.py(1.32) - 4, { hue: 'ink-soft', r: 1.9 });
  f.text(c.px(15) + 12, c.py(1.32), 'one resume', { size: 11, serif: true, hue: 'ink-soft' });
  f.rule(c.px(15) + 84, c.py(1.32) - 4, c.px(15) + 102, c.py(1.32) - 4, { hue: 'ink-soft', width: 1.8 });
  f.text(c.px(15) + 108, c.py(1.32), 'median of one size', { size: 11, serif: true, hue: 'ink-soft' });
});
