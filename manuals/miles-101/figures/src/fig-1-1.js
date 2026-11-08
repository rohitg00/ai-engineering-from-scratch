'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const run = load(path.join(__dirname, '../../capture/gpu/summary/miles-gb10-lab.json')).runs['plain-48'];
const m = run.median_unpaused;
const s = key => `${m[key].median.toFixed(1)} s`;
const diffs = run.per_step.map(p => p.train_time_s - p.log_probs_time_s).sort((a, b) => a - b);
const gradient = `${((diffs[diffs.length / 2 - 1] + diffs[diffs.length / 2]) / 2).toFixed(1)} s`;

module.exports = figure('fig-1-1', {
  height: 360,
  title: 'One GRPO step on one GPU',
  desc: `Six stages repeat every step on one DGX Spark GB10 with Qwen3-0.6B. Prompts go to the SGLang engine, which writes 256 answers in ${s('rollout_time_s')}. A math reward scores each answer. The FSDP trainer computes log probabilities in ${s('log_probs_time_s')}, then takes the gradient step in ${gradient}. Together they are the training phase of ${s('train_time_s')}. A weight update of ${m.update_weights_time_s.median.toFixed(2)} s gives the engine the new weights. Medians of ${m.step_time_s.steps} steps of a run made before we added the heat guard, so no pause could occur.`,
}, f => {
  const prompts = f.box({ x: 20, y: 36, w: 160, h: 64, hue: 'green', title: 'GSM8K prompts', sub: ['32 prompts a step'] });
  const engine = f.box({ x: 240, y: 36, w: 170, h: 64, hue: 'violet', title: 'SGLang engine', sub: ['sglang::scheduler', `256 answers, ${s('rollout_time_s')}`] });
  const reward = f.box({ x: 470, y: 36, w: 150, h: 64, hue: 'green', title: 'math reward', sub: ['1 or 0 per answer'] });
  const logp = f.box({ x: 470, y: 176, w: 150, h: 64, hue: 'blue', title: 'log probabilities', titleSize: 12, sub: ['FSDPTrainRayActor', s('log_probs_time_s')] });
  const train = f.box({ x: 240, y: 176, w: 170, h: 64, hue: 'blue', title: 'GRPO update', sub: ['Adam, one step', gradient] });
  const sync = f.box({ x: 20, y: 176, w: 160, h: 64, hue: 'amber', title: 'weight update', sub: ['GPU handles, GPU copy', `${m.update_weights_time_s.median.toFixed(2)} s`] });

  f.arrow([prompts.x + prompts.w, 68], [engine.x - 1, 68], { style: 'call' });
  f.step(210, 56, 1);
  f.arrow([engine.x + engine.w, 68], [reward.x - 1, 68], { style: 'model' });
  f.step(440, 56, 2);
  f.arrow([545, reward.y + reward.h], [545, logp.y - 1], { style: 'event' });
  f.step(563, 138, 3);
  f.arrow([logp.x, 208], [train.x + train.w + 1, 208], { style: 'model' });
  f.step(440, 196, 4);
  f.arrow([train.x, 208], [sync.x + sync.w + 1, 208], { style: 'write' });
  f.step(210, 196, 5);
  f.path(`M100 ${sync.y} V138 H325 V${engine.y + engine.h + 1}`, { style: 'state' });
  f.step(118, 126, 6);

  f.kicker(20, 290, `one step, median of ${m.step_time_s.steps} steps, run before the heat guard`);
  f.text(20, 314, `${s('step_time_s')} in all. Training takes the most time, and the weight update the least.`, { size: 12, serif: true });
  f.text(20, 336, 'Engine and trainer take turns on the same GPU memory.', { size: 12, serif: true, hue: 'ink-soft' });
});
