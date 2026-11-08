'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const rows = load(path.join(__dirname, '../../capture/gpu/summary/miles-gb10-lab.json')).runs['e6a-base'].per_step;
const clean = rows.filter(r => !r.rollout_paused_s);
const paused = rows.filter(r => r.rollout_paused_s);
const median = values => { const v = [...values].sort((a, b) => a - b); const n = v.length; return n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2; };

module.exports = figure('fig-5-3', {
  height: 340,
  title: 'A heat pause adds time that is not the work',
  desc: `Rollout seconds per step for one 12-step run. ${paused.length} steps overlapped a heat-guard pause of about 45 s and took about 100 s. The ${clean.length} clean steps had a median of ${median(clean.map(r => r.rollout_time_s)).toFixed(1)} s, and all 12 steps had a median of ${median(rows.map(r => r.rollout_time_s)).toFixed(1)} s.`,
}, f => {
  const c = chart(f, { x: 60, y: 56, w: 560, h: 200, xDomain: [0, 1], yDomain: [0, 120], yTicks: [0, 40, 80, 120], yLabel: 'rollout seconds' });
  c.bars(rows.map(r => ({ name: String(r.step), value: r.rollout_time_s, hue: r.rollout_paused_s ? 'rose' : 'blue', label: String(Math.round(r.rollout_time_s)) })), { width: 30 });
  f.text(340, 290, 'step', { size: 11.5, anchor: 'middle', serif: true, hue: 'ink-soft' });
  legend(f, [{ name: 'clean step', hue: 'blue' }, { name: 'overlapped a pause', hue: 'rose' }], 60, 22);
  f.text(60, 322, `Median of all steps ${median(rows.map(r => r.rollout_time_s)).toFixed(1)} s. Median of clean steps ${median(clean.map(r => r.rollout_time_s)).toFixed(1)} s.`, { size: 12, serif: true });
});
