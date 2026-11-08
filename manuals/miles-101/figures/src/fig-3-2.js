'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/gpu/summary/miles-gb10-lab.json')).runs;
const base = runs['e6a-base'].per_step;
const dapo = runs['e2b-dapo-filter'].per_step;
const work = r => r.rollout_time_s - r.rollout_paused_s;
const dropped = r => r.dropped_all_wrong + r.dropped_all_right;
const median = v => { const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const one = dapo.filter(r => dropped(r) <= 16);
const two = dapo.filter(r => dropped(r) > 16);

module.exports = figure('fig-3-2', {
  height: 340,
  title: 'The filter costs one or two extra batches of prompts',
  desc: `Rollout seconds per step with the heat-guard pause time taken out, for 12 steps with seed 1. Without the filter the median was ${median(base.map(work)).toFixed(1)} s. With the filter and 48 prompts per batch, steps that dropped 16 groups or fewer needed one batch and took a median of ${median(one.map(work)).toFixed(1)} s. Steps that dropped more needed a second batch and took ${median(two.map(work)).toFixed(1)} s.`,
}, f => {
  const c = chart(f, { x: 60, y: 56, w: 560, h: 200, xDomain: [0, 11], yDomain: [0, 200], xTicks: [0, 3, 6, 9, 11], yTicks: [0, 100, 200], xLabel: 'step', yLabel: 'rollout seconds, pause time taken out' });
  c.series(base.map(r => [r.step, work(r)]), { hue: 'grey', name: 'no filter' });
  c.series(dapo.map(r => [r.step, work(r)]), { hue: 'violet', name: 'filter' });
  c.note(1, work(dapo[1]), 'one batch', { anchor: 'middle', dy: 18, hue: 'violet', serif: false });
  c.note(7.5, Math.min(work(dapo[7]), work(dapo[8])), 'one batch', { anchor: 'middle', dy: 18, hue: 'violet', serif: false });
  legend(f, [{ name: 'no filter', hue: 'grey' }, { name: 'DAPO filter, batches of 48 prompts', hue: 'violet' }], 60, 22);
  f.text(60, 326, `Median ${median(base.map(work)).toFixed(0)} s without the filter, ${median(one.map(work)).toFixed(0)} s with one batch, ${median(two.map(work)).toFixed(0)} s with two.`, { size: 12, serif: true });
});
