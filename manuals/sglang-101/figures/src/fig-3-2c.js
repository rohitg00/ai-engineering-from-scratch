'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/gpu/summary/gb10.json')).load;
const series = [
  { key: 'default', name: 'BF16, 0.7', hue: 'plum' },
  { key: 'default-kv-max', name: 'BF16, 0.82', hue: 'plum', dash: 'dashed' },
  { key: 'fp8', name: 'FP8, 0.7', hue: 'green' },
  { key: 'fp8-kv-max', name: 'FP8, 0.82', hue: 'green', dash: 'dashed' },
];

module.exports = figure('fig-3-2c', {
  height: 340,
  title: 'A larger pool bought nothing when the pool was never full',
  desc: 'Output throughput against concurrency from 1 to 64 for Qwen3-30B-A3B on one NVIDIA GB10, three seeds per point, at --mem-fraction-static 0.7 and 0.82. The BF16 pool grew from 234,600 to 383,065 tokens and the FP8 pool from 1,084,458 to 1,378,545, yet each pair of lines lies on top of the other: 235 against 239 tok/s for BF16 and 441 against 443 for FP8 at 64.',
}, f => {
  const c = chart(f, { x: 66, y: 64, w: 540, h: 222, xScale: 'log2', xDomain: [1, 64], yDomain: [0, 500], xTicks: [1, 2, 4, 8, 16, 32, 64], yTicks: [0, 100, 200, 300, 400, 500], xLabel: 'max concurrency', yLabel: 'output tokens per second' });
  for (const s of series) {
    const points = runs[s.key].points;
    c.series(points.map(p => [p.x, p.output_throughput.median]), { hue: s.hue, dash: s.dash, name: s.key, dots: !s.dash });
  }
  legend(f, series, 66, 22);
});
