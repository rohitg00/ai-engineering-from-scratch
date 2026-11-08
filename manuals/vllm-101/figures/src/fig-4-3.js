'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/gpu/summary/l4.json')).load;
const series = [
  { key: 'vllm-b', name: 'default, -O2', hue: 'violet' },
  { key: 'vllm-eager', name: '--enforce-eager', hue: 'rose', dash: 'dashed' },
];

module.exports = figure('fig-4-3', {
  height: 330,
  title: 'Eager mode cost 1.2 to 2.3 percent of the time per token on the L4',
  desc: 'Median time per output token against users at the same time on an NVIDIA L4 with Qwen3-8B, three seeds per point, both runs on 2026-10-21. Eager mode is 1.2 to 2.3 percent slower at every concurrency, for example 61.1 against 60.4 ms at one user and 131.4 against 129.2 ms at 64 users.',
}, f => {
  const c = chart(f, { x: 66, y: 60, w: 540, h: 210, xScale: 'log2', xDomain: [1, 64], yDomain: [50, 140], xTicks: [1, 2, 4, 8, 16, 32, 64], yTicks: [50, 80, 110, 140], xLabel: 'users at the same time', yLabel: 'median ms per token' });
  for (const s of series) {
    const pts = runs[s.key].points;
    c.band(pts.map(p => [p.x, p.median_tpot_ms.min]), pts.map(p => [p.x, p.median_tpot_ms.max]), { hue: s.hue });
    c.series(pts.map(p => [p.x, p.median_tpot_ms.median]), { hue: s.hue, dash: s.dash });
  }
  legend(f, series, 66, 22);
});
