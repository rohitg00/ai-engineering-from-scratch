'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const run = load(path.join(__dirname, '../../capture/gpu/summary/miles-gb10-lab.json')).runs['plain-48'];
const m = run.median_unpaused;
const v = key => m[key].median;
const phases = ['rollout_time_s', 'wake_up_time_s', 'train_time_s', 'sleep_time_s', 'update_weights_time_s'];
const total = phases.reduce((sum, key) => sum + v(key), 0);
const residuals = run.per_step
  .filter(row => row.step_paused_s === 0 && ['step_time_s', ...phases].every(key => typeof row[key] === 'number'))
  .map(row => row.step_time_s - phases.reduce((sum, key) => sum + row[key], 0))
  .sort((a, b) => a - b);
const middle = Math.floor(residuals.length / 2);
const untimed = residuals.length % 2 ? residuals[middle] : (residuals[middle - 1] + residuals[middle]) / 2;

module.exports = figure('fig-8-4', {
  height: 330,
  title: 'The engine and the trainer take turns on one memory',
  desc: `One colocated step drawn to scale from the phase medians of 48 steps of a run made before we added the heat guard. The engine holds its weights and its KV cache during rollout, ${v('rollout_time_s').toFixed(1)} s, then gives them back. The trainer moves its state onto the GPU in ${v('wake_up_time_s').toFixed(2)} s, trains in ${v('train_time_s').toFixed(1)} s, of which ${v('log_probs_time_s').toFixed(1)} s compute the log probabilities, and moves its state off in ${v('sleep_time_s').toFixed(2)} s. The engine loads again and gets the new weights in ${v('update_weights_time_s').toFixed(2)} s. Over the same ${residuals.length} steps, a median of ${untimed.toFixed(1)} s of each ${v('step_time_s').toFixed(1)} s step has no timer.`,
}, f => {
  const x0 = 160;
  const w = 460;
  const px = t => x0 + (t / total) * w;
  const t1 = v('rollout_time_s');
  const t2 = t1 + v('wake_up_time_s');
  const t3 = t2 + v('train_time_s');
  const t4 = t3 + v('sleep_time_s');
  const t5 = t4 + v('update_weights_time_s');

  f.kicker(20, 28, 'phase medians of 48 steps, to scale');
  f.text(20, 74, 'engine', { size: 12, weight: 700, hue: 'violet' });
  f.text(20, 92, 'weights, KV cache', { size: 11, serif: true, hue: 'ink-soft' });
  f.rect(px(0), 58, px(t1) - px(0), 40, { hue: 'violet' });
  f.text((px(0) + px(t1)) / 2, 83, `rollout ${t1.toFixed(1)} s`, { size: 11.5, anchor: 'middle', hue: 'violet' });
  f.rect(px(t4), 58, px(t5) - px(t4) + 2, 40, { hue: 'violet' });

  f.text(20, 144, 'trainer', { size: 12, weight: 700, hue: 'blue' });
  f.text(20, 162, 'weights, optimizer', { size: 11, serif: true, hue: 'ink-soft' });
  f.rect(px(t1), 128, px(t4) - px(t1), 40, { hue: 'blue' });
  f.text((px(t2) + px(t3)) / 2, 153, `train ${(t3 - t2).toFixed(1)} s, with ${v('log_probs_time_s').toFixed(1)} s of log-probs`, { size: 11.5, anchor: 'middle', hue: 'blue' });

  f.line(px(t1), 50, px(t1), 176, { style: 'state', head: false, packet: false });
  f.line(px(t4), 50, px(t4), 176, { style: 'state', head: false, packet: false });
  f.text(px(t1) + 4, 196, `trainer onload ${v('wake_up_time_s').toFixed(2)} s`, { size: 11, hue: 'amber' });
  f.text(px(t4) - 4, 196, `trainer offload ${v('sleep_time_s').toFixed(2)} s`, { size: 11, anchor: 'end', hue: 'amber' });
  f.text(px(t4) - 4, 214, `then the update ${v('update_weights_time_s').toFixed(2)} s`, { size: 11, anchor: 'end', hue: 'amber' });

  f.text(20, 252, 'Only one side holds the GPU memory at a time.', { size: 12, serif: true });
  f.text(20, 274, 'The timed hand-offs take about 2 s of a step of about 2.5 minutes.', { size: 12, serif: true });
  f.text(20, 304, `A median of ${untimed.toFixed(1)} s of each step has no timer, such as the engine release.`, { size: 11.5, serif: true, hue: 'ink-soft' });
});
