'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/lab/summary/resume-x86.json'));
const node = runs.node_local.points;
const store = runs.object_store.points;
const at = (points, x) => points.find(p => p.x === x);
const slope = points => (at(points, 1000).seconds.median - at(points, 0).seconds.median);
const nodeLast = at(node, 1000);
const storeLast = at(store, 1000);
const outlier = Math.max(...nodeLast.runs);
const outlierIndex = nodeLast.runs.indexOf(outlier) + 1;
const ordinal = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'][outlierIndex];
const total = [...node, ...store].reduce((sum, p) => sum + p.runs.length, 0);
const two = value => (Math.round(value * 100) / 100).toFixed(2);
const medians = points => points.map(p => `${two(p.seconds.median)} s at ${p.x} MiB`).join(', ');

module.exports = figure('fig-3-3', {
  height: 352,
  title: 'Resume time against the memory an actor holds',
  desc: `Seconds for one request to a suspended actor against the MiB of random memory it holds, on the x86 server guest with gVisor. Every one of the ${total} resumes is a small dot, and a line joins the medians. From the snapshot on the node the median is ${medians(node)}, with ten resumes for each size. One resume at 1000 MiB took ${two(outlier)} s and the other nine took at most ${two(Math.max(...nodeLast.runs.filter(v => v !== outlier)))} s. From the object store in the same cluster the median is ${medians(store)}, with five resumes for each size. A dashed line marks 0.5 s, which the node path passes above 200 MiB and the object store path above 50 MiB.`,
}, f => {
  const c = chart(f, { x: 46, y: 40, w: 440, h: 270, xDomain: [0, 1000], yDomain: [0, 6], xTicks: [0, 50, 200, 500, 1000], yTicks: [0, 1, 2, 3, 4, 5, 6], xFormat: v => String(v), xLabel: 'memory the actor holds, MiB', yLabel: 'seconds from request to reply, at the client' });
  const strip = (points, hue, dx) => {
    for (const p of points) {
      const x = c.px(p.x) + (p.x === 0 ? dx + 6 : dx);
      f.rule(x, c.py(p.seconds.max), x, c.py(p.seconds.min), { hue, opacity: 0.45 });
      for (const v of p.runs) f.dot(x, c.py(v), { hue, r: 1.9 });
    }
  };

  f.rule(c.px(0), c.py(0.5), c.px(1000), c.py(0.5), { hue: 'ink-soft', dash: 'dashed' });
  c.series(store.map(p => [p.x, p.seconds.median]), { hue: 'teal', name: 'object store', dots: false });
  c.series(node.map(p => [p.x, p.seconds.median]), { hue: 'violet', name: 'node', dots: false });
  strip(store, 'teal', 4);
  strip(node, 'violet', -4);

  f.text(c.px(1000) + 14, c.py(storeLast.seconds.median) + 4, 'object store', { size: 11.5, weight: 700, hue: 'teal' });
  f.text(c.px(1000) + 14, c.py(storeLast.seconds.median) + 19, `${two(storeLast.seconds.median)} s median of ${storeLast.seconds.n}`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(c.px(1000) + 14, c.py(nodeLast.seconds.median) + 4, 'node', { size: 11.5, weight: 700, hue: 'violet' });
  f.text(c.px(1000) + 14, c.py(nodeLast.seconds.median) + 19, `${two(nodeLast.seconds.median)} s median of ${nodeLast.seconds.n}`, { size: 11, serif: true, hue: 'ink-soft' });

  f.text(c.px(1000) - 14, c.py(outlier) - 6, `${two(outlier)} s, the ${ordinal} of ${nodeLast.seconds.n} from the node`, { size: 11, serif: true, hue: 'violet', anchor: 'end' });

  f.text(c.px(660), c.py(2.5) + 4, `about ${Math.round(slope(store))} ms per MiB`, { size: 11, serif: true, hue: 'teal' });
  f.text(c.px(700), c.py(0.75) + 4, `about ${Math.round(slope(node))} ms per MiB`, { size: 11, serif: true, hue: 'violet' });

  f.text(c.px(1000) + 14, c.py(0.5) + 4, '0.5 s', { size: 11.5, weight: 700, hue: 'ink-soft' });
  f.text(c.px(1000) + 14, c.py(0.5) + 19, 'what the project states', { size: 11, serif: true, hue: 'ink-soft' });

  f.dot(c.px(20) + 3, c.py(5.6) - 4, { hue: 'ink-soft', r: 1.9 });
  f.text(c.px(20) + 12, c.py(5.6), 'one resume', { size: 11, serif: true, hue: 'ink-soft' });
  f.rule(c.px(20) + 84, c.py(5.6) - 4, c.px(20) + 102, c.py(5.6) - 4, { hue: 'ink-soft', width: 1.8 });
  f.text(c.px(20) + 108, c.py(5.6), 'median of one size', { size: 11, serif: true, hue: 'ink-soft' });

  const cross = [c.px(200) - 4, c.py(at(node, 200).seconds.median)];
  f.leader([c.px(70), c.py(4) + 38], cross, { hue: 'violet' });
  f.text(c.px(20), c.py(4) + 17, 'under 0.5 s up to 200 MiB from the node', { size: 11, serif: true, hue: 'violet' });
  f.text(c.px(20), c.py(4) + 31, 'and up to 50 MiB from the object store', { size: 11, serif: true, hue: 'teal' });
});
