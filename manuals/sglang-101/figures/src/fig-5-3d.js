'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/gpu/summary/l4.json')).prefix;
const series = [
  { key: 'sglang-h2h', name: 'SGLang, radix cache', hue: 'blue' },
  { key: 'vllm', name: 'vLLM, prefix caching', hue: 'amber' },
  { key: 'no-radix-cache', name: 'SGLang, no cache', hue: 'rose', dash: 'dashed' },
];

module.exports = figure('fig-5-3d', {
  height: 350,
  title: 'Two prefix caches, one result',
  desc: 'Median time to first token against shared prompt length from 0 to 4,096 tokens for SGLang 0.5.22 with its radix cache, vLLM 0.31.0 with prefix caching, and SGLang with the cache off, serving Qwen3-8B on one NVIDIA L4 at 8 users, three seeds per point, on a log scale. The two cached lines stay between 354 and 488 ms at every length. Without the cache the median rises to 14,706 ms at 4,096 shared tokens.',
}, f => {
  const c = chart(f, { x: 70, y: 70, w: 536, h: 216, xDomain: [0, 4096], yScale: 'log10', yDomain: [200, 20000], xTicks: [0, 256, 1024, 2048, 4096], yTicks: [200, 500, 1000, 2000, 5000, 10000, 20000], xLabel: 'shared prompt tokens', yLabel: 'median TTFT, ms (log scale)' });
  for (const s of series) {
    const points = runs[s.key].points;
    c.band(points.map(p => [p.x, p.median_ttft_ms.min]), points.map(p => [p.x, p.median_ttft_ms.max]), { hue: s.hue, opacity: 0.1 });
    c.series(points.map(p => [p.x, p.median_ttft_ms.median]), { hue: s.hue, dash: s.dash, name: s.key });
  }
  legend(f, series, 70, 24);
});
