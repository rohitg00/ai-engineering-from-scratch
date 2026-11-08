'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/gpu/summary/gb10.json')).load;
const series = [
  { key: 'vllm', name: 'vLLM 0.31.0', hue: 'blue' },
  { key: 'sglang', name: 'SGLang 0.5.22', hue: 'olive', dash: 'dashed' },
];

module.exports = figure('fig-5-3b', {
  height: 330,
  title: 'On the GB10 the worst token gap of vLLM doubled from 32 users',
  desc: 'The 99th percentile inter-token latency against users at the same time on a DGX Spark with Qwen3-30B-A3B, three seeds per point. The engines match up to 8 users. At 32 users vLLM shows 478 ms and SGLang 220 ms, and at 64 users 528 ms and 271 ms.',
}, f => {
  const c = chart(f, { x: 66, y: 60, w: 540, h: 210, xScale: 'log2', xDomain: [1, 64], yDomain: [0, 600], xTicks: [1, 2, 4, 8, 16, 32, 64], yTicks: [0, 200, 400, 600], xLabel: 'users at the same time', yLabel: 'P99 inter-token latency, ms' });
  for (const s of series) {
    const pts = runs[s.key].points;
    c.band(pts.map(p => [p.x, p.p99_itl_ms.min]), pts.map(p => [p.x, p.p99_itl_ms.max]), { hue: s.hue });
    c.series(pts.map(p => [p.x, p.p99_itl_ms.median]), { hue: s.hue, dash: s.dash });
  }
  c.note(32, 477.92, '478', { dx: -8, dy: -8, anchor: 'end', hue: 'blue', serif: false });
  c.note(32, 219.54, '220', { dx: 8, dy: 16, hue: 'olive', serif: false });
  legend(f, series, 66, 22);
});
