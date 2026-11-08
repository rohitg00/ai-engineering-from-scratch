'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/gpu/summary/miles-gb10-lab.json')).runs;
const base = runs['e6a-base'].per_step;
const dapo = runs['e2b-dapo-filter'].per_step;
const mean = v => v.reduce((a, b) => a + b, 0) / v.length;

module.exports = figure('fig-3-2b', {
  height: 340,
  title: 'The reward before the filter read higher',
  desc: `Mean reward per step over every answer the engine finished, for 12 steps with seed 1. Without the filter: ${mean(base.map(r => r.reward)).toFixed(3)} on average. With the filter, counted before it dropped any group: ${mean(dapo.map(r => r.reward_all_samples)).toFixed(3)}.`,
}, f => {
  const c = chart(f, { x: 60, y: 56, w: 560, h: 200, xDomain: [0, 11], yDomain: [0.5, 0.8], xTicks: [0, 3, 6, 9, 11], yTicks: [0.5, 0.6, 0.7, 0.8], xLabel: 'step', yLabel: 'mean reward of all finished answers' });
  c.series(base.map(r => [r.step, r.reward]), { hue: 'grey', name: 'no filter' });
  c.series(dapo.map(r => [r.step, r.reward_all_samples]), { hue: 'violet', name: 'filter' });
  legend(f, [{ name: 'no filter', hue: 'grey' }, { name: 'DAPO filter, before the filter', hue: 'violet' }], 60, 22);
  f.text(60, 326, `Mean over 12 steps: ${mean(base.map(r => r.reward)).toFixed(3)} without the filter, ${mean(dapo.map(r => r.reward_all_samples)).toFixed(3)} with it. One seed.`, { size: 12, serif: true });
});
