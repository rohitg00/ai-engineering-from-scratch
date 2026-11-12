'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/lab/summary/resume-x86.json'));
const first = runs.new_actor_first_call.points;
const later = runs.node_local.points;
const last = first[first.length - 1];
const mid = first.find(p => p.x === 500);
const small = first.find(p => p.x === 200);
const lastLater = later[later.length - 1];
const two = value => (Math.round(value * 100) / 100).toFixed(2);
const medians = points => points.map(p => `${two(p.seconds.median)} s at ${p.x} MiB`).join(', ');
const sorted = p => p.runs.slice().sort((a, b) => a - b).map(two).join(', ');

module.exports = figure('fig-3-1b', {
  height: 352,
  title: 'The first call of a new actor against the memory in its template',
  desc: `Seconds for the first request to a new actor, which restores the golden snapshot, against the MiB of memory the template holds, on the x86 server guest. Each of the 25 new actors is one dot, five for each size, and a line joins the medians: ${medians(first)}. The five first calls at 500 MiB took ${sorted(mid)} seconds, and the five at 1000 MiB took ${sorted(last)} seconds. A second line shows the median of ten later resumes of one actor from its own snapshot on the node, which reaches ${two(lastLater.seconds.median)} s at 1000 MiB.`,
}, f => {
  const c = chart(f, { x: 46, y: 40, w: 440, h: 270, xDomain: [0, 1000], yDomain: [0, 14], xTicks: [0, 50, 200, 500, 1000], yTicks: [0, 2, 4, 6, 8, 10, 12, 14], xFormat: v => String(v), xLabel: 'memory the template holds, MiB', yLabel: 'seconds from request to reply, at the client' });
  c.series(later.map(p => [p.x, p.seconds.median]), { hue: 'violet', name: 'later resume', dots: false });
  c.series(first.map(p => [p.x, p.seconds.median]), { hue: 'teal', name: 'first call', dots: false });
  for (const p of first) {
    const x = c.px(p.x) + (p.x === 0 ? 5 : 0);
    f.rule(x, c.py(p.seconds.max), x, c.py(p.seconds.min), { hue: 'teal', opacity: 0.45 });
    for (const v of p.runs) f.dot(x, c.py(v), { hue: 'teal', r: 2.4 });
  }

  const lx = c.px(1000) + 14;
  f.text(lx, c.py(last.seconds.max) + 4, `${two(last.seconds.max)} s slowest`, { size: 11, serif: true, hue: 'teal' });
  f.text(lx, c.py(last.seconds.median) + 4, 'first call', { size: 11.5, weight: 700, hue: 'teal' });
  f.text(lx, c.py(last.seconds.median) + 19, `${two(last.seconds.median)} s median of ${last.seconds.n}`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(lx, c.py(last.seconds.min) + 4, `${two(last.seconds.min)} s fastest`, { size: 11, serif: true, hue: 'teal' });
  f.text(lx, c.py(lastLater.seconds.median) + 8, 'later resume', { size: 11.5, weight: 700, hue: 'violet' });
  f.text(lx, c.py(lastLater.seconds.median) + 23, `${two(lastLater.seconds.median)} s median of ${lastLater.seconds.n}`, { size: 11, serif: true, hue: 'ink-soft' });

  f.text(c.px(500), c.py(10) + 16, 'five new actors at 500 MiB:', { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });
  f.text(c.px(500), c.py(10) + 30, `${sorted(mid)} s`, { size: 11, serif: true, hue: 'teal', anchor: 'middle' });
  f.leader([c.px(110), c.py(6) + 36], [c.px(200), c.py(small.seconds.median)], { hue: 'teal' });
  f.text(c.px(20), c.py(6) + 16, 'up to 200 MiB the first call', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(c.px(20), c.py(6) + 30, `stays under ${Math.ceil(small.seconds.max * 10) / 10} s`, { size: 11, serif: true, hue: 'ink-soft' });

  f.dot(c.px(20) + 3, c.py(13) - 4, { hue: 'teal', r: 2.4 });
  f.text(c.px(20) + 12, c.py(13), 'the first call of one new actor', { size: 11, serif: true, hue: 'ink-soft' });
  f.rule(c.px(20), c.py(13) + 10, c.px(20) + 18, c.py(13) + 10, { hue: 'ink-soft', width: 1.8 });
  f.text(c.px(20) + 24, c.py(13) + 14, 'median of one size', { size: 11, serif: true, hue: 'ink-soft' });
});
