'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/gpu/summary/l4.json')).load;
const base = x => runs.default.points.find(q => q.x === x);
const tpot = runs.eagle3.points.map(p => [p.x, base(p.x).median_tpot_ms.median / p.median_tpot_ms.median]);
const served = runs.eagle3.points.map(p => [p.x, p.output_throughput.median / base(p.x).output_throughput.median]);
const series = [
  { name: 'time per token, default over EAGLE-3', hue: 'violet' },
  { name: 'output tok/s, EAGLE-3 over default', hue: 'teal' },
];

module.exports = figure('fig-4-4c', {
  height: 340,
  title: 'On a 24 GB card each token got faster, but the server did not',
  desc: 'Two ratios for Qwen3-8B with EAGLE-3 against the BF16 default on one NVIDIA L4, three seeds per point. Time per output token stays about two times shorter at every concurrency. Output throughput is 2.37 times higher at concurrency 1 and falls to 1.00 at 32 and 0.98 at 64, because the KV pool shrank from 24,094 to 9,951 tokens.',
}, f => {
  const c = chart(f, { x: 66, y: 64, w: 540, h: 222, xScale: 'log2', xDomain: [1, 64], yDomain: [0, 3], xTicks: [1, 2, 4, 8, 16, 32, 64], yTicks: [0, 1, 2, 3], xLabel: 'max concurrency', yLabel: 'ratio', yFormat: v => `x${v}` });
  f.rule(c.px(1), c.py(1), c.px(64), c.py(1), { hue: 'rose', dash: 'dashed' });
  c.note(64, 1, 'no gain', { dx: -4, dy: 16, anchor: 'end', hue: 'rose' });
  c.series(tpot, { hue: 'violet', name: 'tpot' });
  c.series(served, { hue: 'teal', name: 'served' });
  for (const [x, y] of [served[0], served[5], served[6]]) c.note(x, y, `x${y.toFixed(2)}`, { dx: x === 1 ? 6 : -4, dy: x === 1 ? -8 : -10, anchor: x === 1 ? 'start' : 'end', hue: 'teal' });
  legend(f, series, 66, 22);
});
