'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/gpu/summary/l4.json'))['working-set'];
const series = [
  { key: 'default', name: 'GPU pool only', hue: 'rose' },
  { key: 'hicache', name: 'HiCache, host pool of 96,377 tokens', hue: 'green' },
];

module.exports = figure('fig-3-5c', {
  height: 340,
  title: 'HiCache held the prompts that the GPU pool evicted',
  desc: 'Median time to first token against the number of distinct 2,048-token system prompts on one NVIDIA L4 with Qwen3-8B, three seeds per point, on a log scale. The GPU pool holds 24,094 tokens. At 4 prompts both servers take about 360 ms. At 16 and 32 prompts the default takes 3,259 and 5,449 ms and HiCache 553 and 817 ms. At 64 prompts, more than the GPU and host pools hold together, the default takes 6,821 ms and HiCache 3,610 ms.',
}, f => {
  const c = chart(f, { x: 70, y: 64, w: 536, h: 222, xScale: 'log2', xDomain: [4, 64], yScale: 'log10', yDomain: [100, 10000], xTicks: [4, 8, 16, 32, 64], yTicks: [100, 300, 1000, 3000, 10000], xLabel: 'distinct 2,048-token system prompts', yLabel: 'median TTFT, ms (log scale)' });
  for (const s of series) {
    const points = runs[s.key].points;
    c.band(points.map(p => [p.x, p.median_ttft_ms.min]), points.map(p => [p.x, p.median_ttft_ms.max]), { hue: s.hue });
    c.series(points.map(p => [p.x, p.median_ttft_ms.median]), { hue: s.hue, name: s.key });
  }
  legend(f, series, 70, 22);
});
