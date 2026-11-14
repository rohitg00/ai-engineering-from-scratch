'use strict';

const fs = require('fs');
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
const range = key => { const ms = v(key).windows.map(w => w.latency_p50_ms); return `${Math.min(...ms).toFixed(1)} and ${Math.max(...ms).toFixed(1)}`; };
const mid = w => { const [a, b] = w.turns.split('-').map(Number); return (a + b) / 2; };
const turns = key => fs.readFileSync(path.join(__dirname, '../..', data.sources.find(file => file.endsWith(`turns-${key}.jsonl`))), 'utf8').trim().split('\n').map(line => JSON.parse(line));
const quantile = (values, q) => {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};
const spread = key => v(key).windows.map(w => {
  const [a, b] = w.turns.split('-').map(Number);
  const ms = turns(key).filter(t => t.turn >= a && t.turn <= b).map(t => t.latency_ms);
  if (ms.length !== b - a + 1) throw new Error(`fig-4-5: ${key} turns ${w.turns} are not all in the jsonl`);
  return { x: (a + b) / 2, lo: quantile(ms, 0.1), hi: quantile(ms, 0.9) };
});
const bands = Object.fromEntries(variants.map(variant => [variant.key, spread(variant.key)]));
const widest = Math.max(...variants.filter(variant => variant.key !== 'none').flatMap(variant => bands[variant.key].slice(1).map(b => b.hi)));

module.exports = figure('fig-4-5', {
  height: 368,
  title: 'Turn time over 2,000 turns, with and without summarization',
  desc: `A dot chart of the median turn time of each block of 100 turns, on a log scale from 10 to 1,000 ms, over 2,000 turns on the x86 server guest. Without summarization the median grows from ${v('none').windows[0].latency_p50_ms} ms to ${v('none').windows[19].latency_p50_ms} ms. With a trigger of 60 messages it stays between ${range('msgs60_keep7')} ms, with 20 messages near 32 ms, and with 6,000 tokens it falls from ${v('tok6000_keep1500').windows[0].latency_p50_ms} ms to about 43 ms. A shaded band behind each line spans the 10th to the 90th percentile of the 100 turns in each block, read from the per-turn log. After turn 100, 90 percent of the turns of every variant with a trigger took at most ${widest.toFixed(0)} ms.`,
}, f => {
  const c = chart(f, { x: 70, y: 40, w: 390, h: 250, yScale: 'log10', xDomain: [0, 2000], yDomain: [10, 1000], xTicks: [0, 500, 1000, 1500, 2000], yTicks: [10, 20, 50, 100, 200, 500, 1000], yLabel: 'median turn, ms', xLabel: 'turn number', xFormat: t => t.toLocaleString('en-US') });
  const ends = [];
  variants.forEach(variant => c.band(bands[variant.key].map(b => [b.x, b.lo]), bands[variant.key].map(b => [b.x, b.hi]), { hue: variant.hue, opacity: 0.12 }));
  variants.forEach(variant => {
    const points = v(variant.key).windows.map(w => [mid(w), w.latency_p50_ms]);
    c.series(points, { hue: variant.hue, r: 2.6 });
    ends.push({ ...variant, y: c.py(points[points.length - 1][1]) });
  });
  ends.sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i += 1) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
  ends.forEach(end => f.text(c.px(2000) + 10, end.y + 4, end.name, { size: 11, hue: end.hue }));
  f.text(20, 340, 'One run per variant on PostgresSaver, fake model. Each dot is the median of 100 turns.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 356, 'The band spans the 10th to the 90th percentile of the same 100 turns.', { size: 11, serif: true, hue: 'ink-soft' });
});
