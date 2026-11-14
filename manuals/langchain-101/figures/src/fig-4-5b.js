'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/checkpoint-cost-x86.json'));
const steps = [10, 100, 1000, 5000];
const channels = [
  { key: 'plain', hue: 'plum', name: 'plain, add_messages' },
  { key: 'delta100', hue: 'teal', name: 'DeltaChannel, every 100' },
  { key: 'delta1000', hue: 'indigo', name: 'DeltaChannel, every 1,000' },
];
const cell = (channel, n) => data.cells[`postgres ${channel} ${n}`];
const median = values => {
  const s = [...values].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

module.exports = figure('fig-4-5b', {
  height: 360,
  title: 'Storage of one thread by steps, plain and DeltaChannel',
  desc: `A log-log dot chart of the storage of one thread in MB against steps, 10 to 5,000, on PostgresSaver on the x86 server guest. The plain channel stores ${cell('plain', 10).thread_mb[0]}, ${cell('plain', 100).thread_mb[0]}, ${cell('plain', 1000).thread_mb[0]}, and ${cell('plain', 5000).thread_mb[0]} MB. DeltaChannel with a snapshot every 100 steps stores ${cell('delta100', 5000).thread_mb[0]} MB at 5,000 steps, and every 1,000 steps stores ${cell('delta1000', 5000).thread_mb[0]} MB.`,
}, f => {
  const c = chart(f, { x: 70, y: 40, w: 370, h: 250, xScale: 'log10', yScale: 'log10', xDomain: [7, 7000], yDomain: [0.01, 10000], xTicks: steps, yTicks: [0.01, 0.1, 1, 10, 100, 1000, 10000], yLabel: 'MB in one thread', xLabel: 'steps', yFormat: t => (t >= 1000 ? `${t / 1000}k` : String(t)) });
  const ends = [];
  channels.forEach(channel => {
    const points = steps.map(n => [n, median(cell(channel.key, n).thread_mb)]);
    c.series(points, { hue: channel.hue, dots: false });
    steps.forEach(n => cell(channel.key, n).thread_mb.forEach((value, j) => f.dot(c.px(n) + (j - 1) * 4, c.py(value), { hue: channel.hue, r: 2.8 })));
    ends.push({ ...channel, y: c.py(points[points.length - 1][1]) });
  });
  ends.sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i += 1) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
  ends.forEach(end => f.text(c.px(7000) + 8, end.y + 4, end.name, { size: 11, hue: end.hue }));
  f.text(70, 346, 'Each dot is one run, durability sync, one 400-character message per step.', { size: 11, serif: true, hue: 'ink-soft' });
});
