'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/validation-memory-x86.json'));
const fills = [
  { key: 'rand', name: 'all random bytes', share: 'the size of the memory' },
  { key: 'mixed', name: 'half zero, half random', share: 'half of the memory' },
  { key: 'zero', name: 'all zero bytes', share: 'about 4 MiB at both sizes' },
];
const of = key => data.actors.filter(a => a.fill === key).sort((a, b) => a.x - b.x);
const one = value => value.toFixed(1);
const two = value => (Math.round(value * 100) / 100).toFixed(2);
const list = key => of(key).map(a => `${one(a.node_snapshot.mib)} MiB at ${a.x} MiB held`).join(' and ');
const resumes = key => of(key).map(a => `${two(a.resume_node.seconds.median)} s`).join(' and ');

module.exports = figure('fig-3-4d', {
  height: 362,
  title: 'Snapshot size on the node against memory held, for three kinds of memory',
  desc: `MiB of the snapshot on the node against the MiB of memory that the actor holds, on the x86 server guest with gVisor, one actor for each of six templates. All random bytes: ${list('rand')}. Half zero and half random: ${list('mixed')}. All zero bytes: ${list('zero')}. A dashed line marks a snapshot as large as the memory held. The median resume from the node, of ten for each actor, is ${resumes('rand')} for random, ${resumes('mixed')} for half and half, and ${resumes('zero')} for zero.`,
}, f => {
  const c = chart(f, { x: 52, y: 40, w: 330, h: 270, xDomain: [0, 550], yDomain: [0, 550], xTicks: [0, 200, 500], yTicks: [0, 100, 200, 300, 400, 500], xFormat: v => String(v), xLabel: 'memory the actor holds, MiB', yLabel: 'snapshot on the node, MiB' });
  f.rule(c.px(0), c.py(0), c.px(550), c.py(550), { hue: 'ink-soft', dash: 'dashed' });
  f.text(c.px(300), c.py(420), 'size equals memory held', { size: 11, serif: true, hue: 'ink-soft', anchor: 'end' });

  const right = c.px(550) + 14;
  fills.forEach((fill, index) => {
    const actors = of(fill.key);
    c.series(actors.map(a => [a.x, a.node_snapshot.mib]), { hue: 'teal', dots: false, width: 1.4 });
    for (const a of actors) f.dot(c.px(a.x), c.py(a.node_snapshot.mib), { hue: 'teal', r: 3.2 });
    const low = actors[0];
    const high = actors[actors.length - 1];
    const y = [58, 168, 268][index];
    f.leader([right - 4, y + 4], [c.px(high.x) + 5, c.py(high.node_snapshot.mib)], { hue: 'teal' });
    f.text(right, y, fill.name, { size: 11.5, weight: 700, hue: 'teal' });
    f.text(right, y + 15, `${one(low.node_snapshot.mib)} and ${one(high.node_snapshot.mib)} MiB`, { size: 11, hue: 'teal' });
    f.text(right, y + 30, fill.share, { size: 11, serif: true, hue: 'ink-soft' });
    f.text(right, y + 45, `resume ${two(low.resume_node.seconds.median)} and ${two(high.resume_node.seconds.median)} s`, { size: 11, serif: true, hue: 'violet' });
  });

  f.dot(c.px(18), c.py(520), { hue: 'teal', r: 3.2 });
  f.text(c.px(18) + 9, c.py(520) + 4, 'one actor, one du reading', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(right, 342, 'resume: median of 10, from the node', { size: 11, serif: true, hue: 'violet' });
});
