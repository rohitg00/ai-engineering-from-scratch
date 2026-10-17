'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/gpu/summary/l4.json')).prefix;
const series = [
  { key: 'default', name: 'radix cache on', hue: 'green' },
  { key: 'no-radix-cache', name: '--disable-radix-cache', hue: 'rose' },
];

module.exports = figure('fig-3-3c', {
  height: 340,
  title: 'The longer the shared prompt, the more the tree saves',
  desc: 'Median time to first token against the length of a shared system prompt on one NVIDIA L4 with Qwen3-8B, three seeds per point, on a log scale. With the radix cache the median stays between 349 and 479 ms. Without it the median grows from 379 ms with no shared prompt to 14,706 ms with 4,096 shared tokens.',
}, f => {
  const c = chart(f, { x: 70, y: 64, w: 536, h: 222, xDomain: [0, 4096], yScale: 'log10', yDomain: [100, 30000], xTicks: [0, 1024, 2048, 3072, 4096], yTicks: [100, 300, 1000, 3000, 10000, 30000], xLabel: 'shared system prompt, tokens', yLabel: 'median TTFT, ms (log scale)' });
  for (const s of series) {
    const points = runs[s.key].points;
    c.band(points.map(p => [p.x, p.median_ttft_ms.min]), points.map(p => [p.x, p.median_ttft_ms.max]), { hue: s.hue });
    c.series(points.map(p => [p.x, p.median_ttft_ms.median]), { hue: s.hue, name: s.key });
    const last = points[points.length - 1];
    c.note(last.x, last.median_ttft_ms.median, `${Math.round(last.median_ttft_ms.median).toLocaleString('en-US')} ms`, { dx: -8, dy: -10, anchor: 'end', hue: s.hue });
  }
  legend(f, series, 70, 22);
});
