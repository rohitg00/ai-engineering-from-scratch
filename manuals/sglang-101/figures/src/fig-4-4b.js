'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/gpu/summary/gb10.json')).load;
const ratio = runs.eagle3.points.map(p => [p.x, runs.default.points.find(q => q.x === p.x).median_tpot_ms.median / p.median_tpot_ms.median]);

module.exports = figure('fig-4-4b', {
  height: 350,
  title: 'On a mixture-of-experts model the EAGLE-3 gain grows with the batch',
  desc: 'Speedup of median time per output token with EAGLE-3 over the BF16 default for Qwen3-30B-A3B on a GB10. It is 1.60 times at concurrency 1, rises to 1.89 at 32 and is 1.84 at 64, while the accept length stays near 2.7 tokens per step.',
}, f => {
  const c = chart(f, { x: 66, y: 56, w: 540, h: 220, xScale: 'log2', xDomain: [1, 64], yDomain: [0, 3], xTicks: [1, 2, 4, 8, 16, 32, 64], yTicks: [0, 1, 2, 3], xLabel: 'max concurrency (benchmark client)', yLabel: 'default TPOT divided by EAGLE-3 TPOT', yFormat: v => `x${v}` });
  f.rule(c.px(1), c.py(1), c.px(64), c.py(1), { hue: 'rose', dash: 'dashed' });
  c.note(64, 1, 'no gain', { dx: -4, dy: 16, anchor: 'end', hue: 'rose' });
  c.series(ratio, { hue: 'violet', name: 'speedup' });
  for (const [x, y] of ratio) c.note(x, y, `x${y.toFixed(2)}`, { dx: x === 1 ? 6 : x === 64 ? -4 : 0, dy: 20, anchor: x === 1 ? 'start' : x === 64 ? 'end' : 'middle', hue: 'violet' });
  const acc = runs.eagle3.points.map(p => p.accept_length.median);
  f.text(66, 340, `accept length ${Math.min(...acc).toFixed(2)} to ${Math.max(...acc).toFixed(2)} tokens per step at every concurrency`, { size: 11, serif: true, hue: 'ink-soft' });
  legend(f, [{ name: 'EAGLE-3 speedup', hue: 'violet' }], 66, 22);
});
