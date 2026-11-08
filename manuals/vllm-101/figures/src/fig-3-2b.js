'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const prefix = load(path.join(__dirname, '../../capture/gpu/summary/l4.json')).prefix;
const series = [
  { key: 'vllm', name: 'prefix cache on, the default', hue: 'green' },
  { key: 'vllm-no-prefix-cache', name: 'prefix cache off', hue: 'rose' },
];

module.exports = figure('fig-3-2b', {
  height: 340,
  title: 'With the cache on, the first token stays near 400 ms at every shared length',
  desc: 'Median time to first token against the shared system prompt length, on an NVIDIA L4 with Qwen3-8B, 8 users, three seeds, log scale. With the cache on, it stays between 375 and 488 ms. With it off, it grows to 1,213 ms at 1,024 tokens and 13,353 ms at 4,096 tokens, where the GPU clock also fell.',
}, f => {
  const c = chart(f, { x: 70, y: 64, w: 536, h: 216, xDomain: [0, 4096], yScale: 'log10', yDomain: [300, 20000], xTicks: [0, 1024, 2048, 3072, 4096], xFormat: v => v.toLocaleString('en-US'), yTicks: [300, 1000, 3000, 10000], xLabel: 'shared system prompt, tokens', yLabel: 'median TTFT, ms (log scale)' });
  for (const s of series) {
    const pts = prefix[s.key].points;
    c.band(pts.map(p => [p.x, p.median_ttft_ms.min]), pts.map(p => [p.x, p.median_ttft_ms.max]), { hue: s.hue });
    c.series(pts.map(p => [p.x, p.median_ttft_ms.median]), { hue: s.hue });
  }
  c.note(4096, 13353, '13,353', { dx: -6, dy: -8, anchor: 'end', hue: 'rose' });
  c.note(1024, 1213, '1,213', { dx: 10, dy: 4, hue: 'rose', knock: true });
  legend(f, series, 70, 22);
});
