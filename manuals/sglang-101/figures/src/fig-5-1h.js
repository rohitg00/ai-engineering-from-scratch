'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/gpu/summary/l4.json')).waves;
const series = [
  { key: 'default', metric: 'median_ttft_ms', name: 'BF16 median TTFT', hue: 'plum' },
  { key: 'fp8', metric: 'median_ttft_ms', name: 'FP8 median TTFT', hue: 'green' },
  { key: 'default', metric: 'p99_itl_ms', name: 'BF16 P99 ITL', hue: 'plum', dash: 'dashed' },
  { key: 'fp8', metric: 'p99_itl_ms', name: 'FP8 P99 ITL', hue: 'green', dash: 'dashed' },
];

module.exports = figure('fig-5-1h', {
  height: 360,
  title: 'Fixed lengths trade a slow first token for smooth decoding',
  desc: 'Median time to first token and P99 inter-token latency against --random-range-ratio on one NVIDIA L4 with Qwen3-8B, a cap of 16 and 64 prompts, three seeds per point, on a log scale. At a ratio of 1.0 every request has 512 input and 128 output tokens, and the median TTFT is 1,996 ms for BF16 and 1,526 ms for FP8, while P99 ITL is 82 and 55 ms. At a ratio of 0.0 the lengths vary, the median TTFT is 291 and 129 ms, and P99 ITL is 300 and 95 ms.',
}, f => {
  const c = chart(f, { x: 70, y: 84, w: 536, h: 210, xDomain: [0, 1], yScale: 'log10', yDomain: [30, 3000], xTicks: [0, 0.5, 1], yTicks: [30, 100, 300, 1000, 3000], xLabel: '--random-range-ratio (1.0 means every request has the same length)', yLabel: 'ms (log scale)' });
  for (const s of series) {
    const points = runs[s.key].points;
    c.band(points.map(p => [p.x, p[s.metric].min]), points.map(p => [p.x, p[s.metric].max]), { hue: s.hue, opacity: 0.1 });
    c.series(points.map(p => [p.x, p[s.metric].median]), { hue: s.hue, dash: s.dash, name: `${s.key}-${s.metric}` });
  }
  legend(f, series.slice(0, 2), 70, 22);
  legend(f, series.slice(2), 70, 44);
});
