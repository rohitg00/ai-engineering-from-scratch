'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const summary = load(path.join(__dirname, '../../capture/gpu/summary/gb10.json'));
const at16 = key => summary.load[key].points.find(p => p.x === 16);
const series = [
  { key: 'fp8', name: 'FP8', hue: 'green' },
  { key: 'default', name: 'BF16', hue: 'plum' },
  { key: 'eagle3', name: 'EAGLE-3', hue: 'violet' },
];

module.exports = figure('fig-5-1e', {
  height: 340,
  title: 'TTFT quantiles of three runs at a cap of 16',
  desc: 'Quantile curve of time to first token for the pooled requests of three seeds at a cap of 16 on a GB10, drawn from 51 quantiles between 0 and 100 percent. BF16 and FP8 rise steeply near 140 to 240 milliseconds, then flatten and finish near 1.2 and 1.7 seconds. EAGLE-3 starts later, near 580 milliseconds at the median, and has the shortest tail.',
}, f => {
  const c = chart(f, { x: 66, y: 56, w: 540, h: 230, xScale: 'log10', xDomain: [30, 3000], yDomain: [0, 1], xTicks: [30, 100, 300, 1000, 3000], yTicks: [0, 0.25, 0.5, 0.75, 1], xLabel: 'time to first token, ms (log scale)', yLabel: 'share of requests', yFormat: v => `${Math.round(v * 100)}%` });
  f.rule(c.px(30), c.py(0.9), c.px(3000), c.py(0.9), { hue: 'rose', dash: 'dashed' });
  c.note(3000, 0.9, 'P90', { dx: -4, dy: -6, anchor: 'end', hue: 'rose' });
  for (const s of series) {
    const t = at16(s.key).ttft_quantiles_ms;
    c.series(t.map((ms, i) => [ms, summary.quantiles[i]]), { hue: s.hue, dots: false, name: s.key });
  }
  legend(f, series, 66, 22);
});
