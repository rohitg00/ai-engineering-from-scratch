'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const run = load(path.join(__dirname, '../../capture/gpu/summary/miles-gb10.json')).plain;
const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const t = run.timers_s;
const items = [
  { name: 'rollout', value: median(run.rollouts.map(r => r['perf/rollout_time'])), hue: 'green' },
  { name: 'log probs', value: t.log_probs.median, hue: 'violet' },
  { name: 'train', value: t.actor_train.median, hue: 'violet' },
  { name: 'weights', value: t.update_weights.median, hue: 'amber' },
  { name: 'sleep, wake', value: t.sleep.median + t.wake_up.median, hue: 'amber' },
];

module.exports = figure('fig-7-2c', {
  height: 330,
  title: 'One GRPO step on a GB10, by phase',
  desc: 'Median seconds per phase over 12 plain GRPO steps of Miles with Qwen3-0.6B on one NVIDIA GB10, with SGLang and FSDP colocated. SGLang rollout takes 57.2 s, the trainer recomputes log probabilities in 25.2 s and trains in 80.3 s, the weight update takes 0.65 s, and sleep and wake take 1.7 s.',
}, f => {
  const c = chart(f, { x: 66, y: 40, w: 540, h: 230, xDomain: [0, 1], yDomain: [0, 100], yTicks: [0, 25, 50, 75, 100], yLabel: 'median seconds per step', yFormat: v => `${v}` });
  c.bars(items.map(i => ({ ...i, label: `${i.value < 10 ? i.value.toFixed(2) : i.value.toFixed(1)} s` })));
});
