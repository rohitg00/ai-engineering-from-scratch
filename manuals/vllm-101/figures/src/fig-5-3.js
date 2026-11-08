'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/gpu/summary/l4.json')).load;
const series = [
  { key: 'vllm', name: 'vLLM 0.31.0', hue: 'blue' },
  { key: 'sglang', name: 'SGLang 0.5.22', hue: 'olive', dash: 'dashed' },
];

module.exports = figure('fig-5-3', {
  height: 330,
  title: 'On the L4 the two engines wrote the same tokens per second up to 32 users',
  desc: 'Output tokens per second against users at the same time on an NVIDIA L4 with Qwen3-8B, the same 24,096-token KV pool, three seeds per point. The two lines are within 3 percent up to 32 users. At 64 users SGLang wrote 256.6 and vLLM 241.4 tokens per second.',
}, f => {
  const c = chart(f, { x: 66, y: 60, w: 540, h: 210, xScale: 'log2', xDomain: [1, 64], yDomain: [0, 300], xTicks: [1, 2, 4, 8, 16, 32, 64], yTicks: [0, 100, 200, 300], xLabel: 'users at the same time', yLabel: 'output tokens per second' });
  for (const s of series) {
    const pts = runs[s.key].points;
    c.band(pts.map(p => [p.x, p.output_throughput.min]), pts.map(p => [p.x, p.output_throughput.max]), { hue: s.hue });
    c.series(pts.map(p => [p.x, p.output_throughput.median]), { hue: s.hue, dash: s.dash });
  }
  legend(f, series, 66, 22);
});
