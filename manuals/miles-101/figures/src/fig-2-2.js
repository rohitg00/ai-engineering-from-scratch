'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/gpu/summary/miles-gb10-lab.json')).runs;
const base = runs['e3e-base-frac025'].per_step;
const kept = runs['e3f-no-offload-rollout-frac025'].per_step;
const both = base.filter((r, i) => !r.rollout_paused_s && !kept[i].rollout_paused_s).map(r => r.step);
const items = [];
for (const s of both) {
  items.push({ name: `step ${s}`, value: base[s].rollout_time_s, hue: 'grey', label: `${base[s].rollout_time_s.toFixed(1)} s` });
  items.push({ name: `step ${s}`, value: kept[s].rollout_time_s, hue: 'violet', label: `${kept[s].rollout_time_s.toFixed(1)} s` });
}

module.exports = figure('fig-2-2', {
  height: 330,
  title: 'Keeping the engine loaded saves one or two seconds',
  desc: `Rollout seconds on the steps that had no heat pause in both runs of a same-day pair, seed 1, engine memory fraction 0.25. Default offload against --no-offload-rollout: ${both.map(s => `step ${s}, ${base[s].rollout_time_s.toFixed(1)} against ${kept[s].rollout_time_s.toFixed(1)} s`).join('; ')}.`,
}, f => {
  const c = chart(f, { x: 60, y: 56, w: 560, h: 200, xDomain: [0, 1], yDomain: [0, 80], yTicks: [0, 80], yLabel: 'rollout seconds, clean steps only' });
  c.bars(items, { width: 52 });
  legend(f, [{ name: 'default offload', hue: 'grey' }, { name: 'engine kept loaded', hue: 'violet' }], 60, 22);
  f.text(60, 314, 'Same step, same answer length: the difference is 0.6 to 1.8 s.', { size: 12, serif: true });
});
