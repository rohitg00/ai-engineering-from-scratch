'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/gpu/summary/gb10.json')).load;
const series = [
  { key: 'default', name: 'BF16 weights, BF16 KV', hue: 'plum' },
  { key: 'fp8', name: 'FP8 weights, FP8 KV', hue: 'green' },
];

module.exports = figure('fig-4-3b', {
  height: 340,
  title: 'FP8 moves the whole latency and throughput curve, not one point',
  desc: 'Each dot is one concurrency from 1 to 64 on a GB10 with Qwen3-30B-A3B, plotted as output throughput against median time per output token. At every concurrency the FP8 dot sits to the right and lower: more tokens per second for less time per token.',
}, f => {
  const c = chart(f, { x: 66, y: 56, w: 540, h: 230, xDomain: [0, 500], yDomain: [0, 300], xTicks: [0, 100, 200, 300, 400, 500], yTicks: [0, 50, 100, 150, 200, 250, 300], xLabel: 'output tokens per second', yLabel: 'median TPOT, ms' });
  for (const s of series) {
    const points = runs[s.key].points;
    c.series(points.map(p => [p.output_throughput.median, p.median_tpot_ms.median]), { hue: s.hue, name: s.key });
    for (const p of points) if (p.x === 1 || p.x === 64) c.note(p.output_throughput.median, p.median_tpot_ms.median, `c${p.x}`, p.x === 1 ? { dx: -8, dy: 4, anchor: 'end', hue: s.hue } : { dx: 8, dy: s.key === 'fp8' ? 16 : -8, hue: s.hue });
  }
  legend(f, series, 66, 22);
});
