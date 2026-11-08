'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const pts = load(path.join(__dirname, '../../capture/gpu/summary/gb10.json')).load.vllm.points;

module.exports = figure('fig-1-3b', {
  height: 330,
  title: 'More users, more tokens in total, a slower stream for each user',
  desc: 'vLLM 0.31.0 on a DGX Spark with Qwen3-30B-A3B, three seeds per point. Left: output tokens per second for all users rise from 29.5 at one user to 239.3 at 64 users. Right: the median time per output token for each user rises from 32.3 ms to 243.8 ms.',
}, f => {
  const ticks = [1, 4, 16, 64];
  const left = chart(f, { x: 56, y: 60, w: 228, h: 196, xScale: 'log2', xDomain: [1, 64], yDomain: [0, 300], xTicks: ticks, yTicks: [0, 100, 200, 300], xLabel: 'users at the same time', yLabel: 'output tokens per second, all users' });
  left.band(pts.map(p => [p.x, p.output_throughput.min]), pts.map(p => [p.x, p.output_throughput.max]), { hue: 'plum' });
  left.series(pts.map(p => [p.x, p.output_throughput.median]), { hue: 'plum' });
  const right = chart(f, { x: 384, y: 60, w: 228, h: 196, xScale: 'log2', xDomain: [1, 64], yDomain: [0, 300], xTicks: ticks, yTicks: [0, 100, 200, 300], xLabel: 'users at the same time', yLabel: 'median ms per token, each user' });
  right.band(pts.map(p => [p.x, p.median_tpot_ms.min]), pts.map(p => [p.x, p.median_tpot_ms.max]), { hue: 'amber' });
  right.series(pts.map(p => [p.x, p.median_tpot_ms.median]), { hue: 'amber' });
  legend(f, [{ name: 'median of three runs, band from lowest to highest', hue: 'ink-soft' }], 56, 22);
});
