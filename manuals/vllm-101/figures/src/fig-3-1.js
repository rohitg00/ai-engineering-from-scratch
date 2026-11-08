'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/gpu/summary/l4.json')).load;
const series = [
  { key: 'vllm-b', name: 'default', hue: 'violet' },
  { key: 'vllm-seqs-16', name: '--max-num-seqs 16', hue: 'rose', dash: 'dashed' },
];

module.exports = figure('fig-3-1', {
  height: 340,
  title: 'A cap of 16 sequences against the default as users grow',
  desc: 'Output tokens per second and median time to first token against users at the same time, on an NVIDIA L4 with Qwen3-8B, three seeds per point, 2026-10-21. The two configs match up to 16 users. At 32 users, the default gave 275.1 tokens per second with a first token in 1.8 s, and the cap of 16 gave 171.8 tokens per second with a first token in 12.3 s.',
}, f => {
  legend(f, series, 66, 22);
  const a = chart(f, { x: 66, y: 60, w: 230, h: 200, xScale: 'log2', xDomain: [1, 64], yDomain: [0, 300], xTicks: [1, 4, 16, 64], yTicks: [0, 100, 200, 300], xLabel: 'users', yLabel: 'output tok/s' });
  const b = chart(f, { x: 376, y: 60, w: 230, h: 200, xScale: 'log2', xDomain: [1, 64], yScale: 'log10', yDomain: [0.1, 100], xTicks: [1, 4, 16, 64], yTicks: [0.1, 1, 10, 100], xLabel: 'users', yLabel: 'median first token, s' });
  for (const s of series) {
    const pts = runs[s.key].points;
    a.band(pts.map(p => [p.x, p.output_throughput.min]), pts.map(p => [p.x, p.output_throughput.max]), { hue: s.hue });
    a.series(pts.map(p => [p.x, p.output_throughput.median]), { hue: s.hue, dash: s.dash });
    b.series(pts.map(p => [p.x, p.median_ttft_ms.median / 1000]), { hue: s.hue, dash: s.dash });
  }
});
