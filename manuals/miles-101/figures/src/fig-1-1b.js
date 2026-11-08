'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const run = load(path.join(__dirname, '../../capture/gpu/summary/miles-gb10-lab.json')).runs['plain-48'];
const m = run.median_unpaused;
const diffs = run.per_step.map(p => p.train_time_s - p.log_probs_time_s).sort((a, b) => a - b);
const gradient = (diffs[diffs.length / 2 - 1] + diffs[diffs.length / 2]) / 2;
const value = key => (key === 'gradient' ? gradient : m[key].median);
const parts = [
  { key: 'rollout_time_s', name: 'rollout', hue: 'violet' },
  { key: 'log_probs_time_s', name: 'log-probs', hue: 'blue' },
  { key: 'gradient', name: 'gradient step', hue: 'blue' },
  { key: 'sleep_time_s', name: 'offload', hue: 'amber' },
  { key: 'wake_up_time_s', name: 'onload', hue: 'amber' },
  { key: 'update_weights_time_s', name: 'update', hue: 'amber' },
];

module.exports = figure('fig-1-1b', {
  height: 330,
  title: 'Where the time of one step goes',
  desc: `Median seconds per phase over 48 steps of a run made before we added the heat guard, Qwen3-0.6B on one GB10: rollout ${m.rollout_time_s.median.toFixed(1)}, log probabilities ${m.log_probs_time_s.median.toFixed(1)}, gradient step ${gradient.toFixed(1)}, which together with the log probabilities is the training phase of ${m.train_time_s.median.toFixed(1)}, trainer offload ${m.sleep_time_s.median.toFixed(2)}, trainer onload ${m.wake_up_time_s.median.toFixed(2)}, and weight update ${m.update_weights_time_s.median.toFixed(2)}.`,
}, f => {
  const c = chart(f, { x: 60, y: 40, w: 560, h: 220, xDomain: [0, 1], yDomain: [0, 100], yTicks: [0, 30, 60, 90], yLabel: 'seconds per step, median' });
  c.bars(parts.map(p => ({ name: p.name, value: value(p.key), hue: p.hue, label: value(p.key) >= 10 ? `${value(p.key).toFixed(1)} s` : `${value(p.key).toFixed(2)} s` })));
  f.text(60, 312, 'Tune training and rollout first. The three amber phases add up to about 2 s.', { size: 12, serif: true });
});
