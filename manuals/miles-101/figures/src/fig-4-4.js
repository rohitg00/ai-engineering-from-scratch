'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/gpu/summary/miles-gb10-lab.json')).runs;
const series = [
  { key: 'e6a-base', name: 'full vocabulary', hue: 'grey', dash: 'dashed' },
  { key: 'e11-topp-topk', name: 'top-p 0.95, top-k 64, replayed', hue: 'green', dash: 'solid' },
];
const med = key => { const v = runs[key].per_step.map(r => r.logprob_abs_diff).sort((a, b) => a - b); return (v[5] + v[6]) / 2; };

module.exports = figure('fig-4-4', {
  height: 330,
  title: 'Replaying the sampled tokens lowers the gap',
  desc: `Mean absolute difference between the engine and trainer log probabilities, per step, for 12 steps with seed 1. Median ${med('e6a-base').toFixed(4)} with the full vocabulary and ${med('e11-topp-topk').toFixed(4)} with top-p and top-k replay.`,
}, f => {
  const c = chart(f, { x: 70, y: 56, w: 550, h: 200, xDomain: [0, 11], yDomain: [0.012, 0.0165], xTicks: [0, 3, 6, 9, 11], yTicks: [0.012, 0.013, 0.014, 0.015, 0.016], yFormat: v => v.toFixed(3), xLabel: 'step', yLabel: 'logprob gap, mean absolute difference' });
  for (const s of series) c.series(runs[s.key].per_step.map(r => [r.step, r.logprob_abs_diff]), { hue: s.hue, dash: s.dash, name: s.name });
  legend(f, series, 70, 22);
  f.text(70, 316, `Median gap ${med('e6a-base').toFixed(4)} to ${med('e11-topp-topk').toFixed(4)}, about ${Math.round((1 - med('e11-topp-topk') / med('e6a-base')) * 100)} percent lower. One seed.`, { size: 12, serif: true });
});
