'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/gpu/summary/gb10.json')).load;
const series = [
  { key: 'fp8', name: 'FP8 + FP8 KV', hue: 'green' },
  { key: 'eagle3', name: 'EAGLE-3', hue: 'violet' },
  { key: 'default', name: 'BF16 default', hue: 'plum' },
  { key: 'no-cuda-graph', name: 'no CUDA graph', hue: 'grey', dash: 'dashed' },
];

module.exports = figure('fig-5-1c', {
  height: 340,
  title: 'Output throughput against concurrency on a GB10, three seeds per point',
  desc: 'Qwen3-30B-A3B on one NVIDIA GB10, 512 tokens in and 128 out. FP8 rises to 441 tokens per second at concurrency 64, BF16 to 235. EAGLE-3 leads BF16 up to 32 and reaches 276 at 64. The run without CUDA graphs lies on top of the default. Bands show the lowest and highest of three seeds.',
}, f => {
  const c = chart(f, { x: 66, y: 56, w: 540, h: 230, xScale: 'log2', xDomain: [1, 64], yDomain: [0, 500], xTicks: [1, 2, 4, 8, 16, 32, 64], yTicks: [0, 100, 200, 300, 400, 500], xLabel: 'max concurrency (benchmark client)', yLabel: 'output tokens per second' });
  for (const s of series) {
    const points = runs[s.key].points;
    c.band(points.map(p => [p.x, p.output_throughput.min]), points.map(p => [p.x, p.output_throughput.max]), { hue: s.hue });
    c.series(points.map(p => [p.x, p.output_throughput.median]), { hue: s.hue, dash: s.dash, name: s.key });
  }
  const top = point => runs[point].points.find(p => p.x === 64).output_throughput.median;
  c.note(64, top('fp8'), String(Math.round(top('fp8'))), { dx: 6, dy: 4, hue: 'green' });
  c.note(64, top('default'), String(Math.round(top('default'))), { dx: 6, dy: 4, hue: 'plum' });
  legend(f, series, 66, 22);
});
