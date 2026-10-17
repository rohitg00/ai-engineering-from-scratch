'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/gpu/summary/l4.json')).load;
const series = [
  { key: 'sglang-h2h', metric: 'median_ttft_ms', name: 'SGLang median TTFT', hue: 'blue' },
  { key: 'vllm', metric: 'median_ttft_ms', name: 'vLLM median TTFT', hue: 'amber' },
  { key: 'sglang-h2h', metric: 'p99_itl_ms', name: 'SGLang P99 ITL', hue: 'blue', dash: 'dashed' },
  { key: 'vllm', metric: 'p99_itl_ms', name: 'vLLM P99 ITL', hue: 'amber', dash: 'dashed' },
];

module.exports = figure('fig-5-3c', {
  height: 370,
  title: 'Same throughput, two different choices at a full pool',
  desc: 'Median time to first token and P99 inter-token latency against concurrency from 1 to 64 for SGLang 0.5.22 and vLLM 0.31.0 with Qwen3-8B on one NVIDIA L4, with KV pools of 24,094 and 24,096 tokens and three seeds per point, on a log scale. Up to 16 the inter-token lines lie together and SGLang gives the first token sooner. At 32 and 64 vLLM gives the first token sooner, 1,813 against 2,871 ms and 10,953 against 18,356 ms, while its P99 inter-token latency rises to 619 and 1,363 ms against 102 and 114 ms for SGLang.',
}, f => {
  const c = chart(f, { x: 70, y: 84, w: 536, h: 222, xScale: 'log2', xDomain: [1, 64], yScale: 'log10', yDomain: [50, 30000], xTicks: [1, 2, 4, 8, 16, 32, 64], yTicks: [50, 100, 300, 1000, 3000, 10000, 30000], xLabel: 'max concurrency', yLabel: 'ms (log scale)' });
  for (const s of series) {
    const points = runs[s.key].points;
    c.band(points.map(p => [p.x, p[s.metric].min]), points.map(p => [p.x, p[s.metric].max]), { hue: s.hue, opacity: 0.1 });
    c.series(points.map(p => [p.x, p[s.metric].median]), { hue: s.hue, dash: s.dash, name: `${s.key}-${s.metric}` });
  }
  legend(f, series.slice(0, 2), 70, 22);
  legend(f, series.slice(2), 70, 44);
});
