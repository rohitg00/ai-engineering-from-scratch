'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/gpu/summary/l4.json')).rate;
const series = [
  { key: 'sglang-h2h', metric: 'median_ttft_ms', name: 'SGLang median TTFT', hue: 'blue' },
  { key: 'vllm', metric: 'median_ttft_ms', name: 'vLLM median TTFT', hue: 'amber' },
  { key: 'sglang-h2h', metric: 'p99_tpot_ms', name: 'SGLang P99 TPOT', hue: 'blue', dash: 'dashed' },
  { key: 'vllm', metric: 'p99_tpot_ms', name: 'vLLM P99 TPOT', hue: 'amber', dash: 'dashed' },
];

module.exports = figure('fig-5-3e', {
  height: 370,
  title: 'The same choice at a fixed arrival rate',
  desc: 'Median time to first token and P99 time per output token against a Poisson arrival rate from 0.5 to 16 requests per second for SGLang 0.5.22 and vLLM 0.31.0 with Qwen3-8B on one NVIDIA L4, with KV pools of 24,094 and 24,096 tokens, 512 input and 128 output tokens, and three seeds per point, on a log scale. Up to 2 requests per second all four lines stay under 1,000 ms. From 4 requests per second the first-token lines rise to many seconds, vLLM lower, and the vLLM P99 time per token rises above the SGLang line, 187 against 127 ms at 4.',
}, f => {
  const c = chart(f, { x: 70, y: 84, w: 536, h: 222, xScale: 'log2', xDomain: [0.5, 16], yScale: 'log10', yDomain: [50, 300000], xTicks: [0.5, 1, 2, 4, 8, 16], yTicks: [50, 100, 300, 1000, 10000, 100000], xLabel: 'offered request rate, requests per second (Poisson)', yLabel: 'ms (log scale)' });
  for (const s of series) {
    const points = runs[s.key].points;
    c.band(points.map(p => [p.x, p[s.metric].min]), points.map(p => [p.x, p[s.metric].max]), { hue: s.hue, opacity: 0.1 });
    c.series(points.map(p => [p.x, p[s.metric].median]), { hue: s.hue, dash: s.dash, name: `${s.key}-${s.metric}` });
  }
  legend(f, series.slice(0, 2), 70, 22);
  legend(f, series.slice(2), 70, 44);
});
