'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/long-threads-x86.json'));
const variants = [
  { key: 'none', hue: 'plum', name: 'no summarization' },
  { key: 'tok6000_keep1500', hue: 'blue', name: '6,000 tokens, keep 1,500' },
  { key: 'msgs60_keep7', hue: 'teal', name: '60 messages, keep 7' },
  { key: 'msgs20_keep1', hue: 'green', name: '20 messages, keep 1' },
];
const v = key => data.variants[key];
const mid = w => { const [a, b] = w.turns.split('-').map(Number); return (a + b) / 2; };

module.exports = figure('fig-4-5', {
  height: 360,
  title: 'Turn time over 2,000 turns, with and without summarization',
  desc: `A dot chart of the median turn time of each block of 100 turns, on a log scale from 20 to 1,000 ms, over 2,000 turns on the x86 server guest. Without summarization the median grows from ${v('none').windows[0].latency_p50_ms} ms to ${v('none').windows[19].latency_p50_ms} ms. With a trigger of 60 messages it stays between about 36 and 39 ms, with 20 messages near 32 ms, and with 6,000 tokens it falls from ${v('tok6000_keep1500').windows[0].latency_p50_ms} ms to about 43 ms.`,
}, f => {
  const c = chart(f, { x: 70, y: 40, w: 390, h: 250, yScale: 'log10', xDomain: [0, 2000], yDomain: [20, 1000], xTicks: [0, 500, 1000, 1500, 2000], yTicks: [20, 50, 100, 200, 500, 1000], yLabel: 'median turn, ms', xLabel: 'turn number', xFormat: t => t.toLocaleString('en-US') });
  const ends = [];
  variants.forEach(variant => {
    const points = v(variant.key).windows.map(w => [mid(w), w.latency_p50_ms]);
    c.series(points, { hue: variant.hue, r: 2.6 });
    ends.push({ ...variant, y: c.py(points[points.length - 1][1]) });
  });
  ends.sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i += 1) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
  ends.forEach(end => f.text(c.px(2000) + 10, end.y + 4, end.name, { size: 11, hue: end.hue }));
  f.text(20, 346, 'One run per variant on PostgresSaver, fake model. Each dot is a median of 100 turns.', { size: 11, serif: true, hue: 'ink-soft' });
});
