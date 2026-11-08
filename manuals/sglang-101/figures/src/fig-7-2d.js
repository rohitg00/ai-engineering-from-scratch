'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/gpu/summary/miles-gb10.json'));
const steps = runs['plain-48'].rollouts;
const seed2 = runs['plain-48-s2'].rollouts;
const seed3 = runs['plain-48-s3'].rollouts;
const series = [
  { key: 'rollout/raw_reward_unfiltered', name: 'raw reward', hue: 'green' },
  { key: 'rollout/truncated_ratio', name: 'share of samples cut at 1,024 tokens', hue: 'rose' },
];
const legendRows = [...series, { name: 'seeds 2 and 3', hue: 'green', dash: 'dashed' }];

module.exports = figure('fig-7-2d', {
  height: 330,
  title: 'Forty-eight GRPO steps on a GB10',
  desc: 'Raw reward and the share of samples cut at the 1,024-token limit for each of 48 plain GRPO steps of Miles with Qwen3-0.6B on GSM8K on one NVIDIA GB10 with the default seed. The mean reward of the first 8 steps is 0.636 and of the last 8 is 0.758. The cut share falls from a mean of 0.33 to 0.08 over the same steps. Dashed lines show the raw rewards of runs with seeds 2 and 3, which rise from means of 0.653 to 0.736 and 0.614 to 0.766.',
}, f => {
  const c = chart(f, { x: 66, y: 62, w: 540, h: 206, xDomain: [0, 47], yDomain: [0, 1], xTicks: [0, 8, 16, 24, 32, 40, 47], yTicks: [0, 0.25, 0.5, 0.75, 1], xLabel: 'GRPO step', yLabel: 'fraction' });
  for (const s of series) c.series(steps.map(step => [step.rollout, step[s.key]]), { hue: s.hue, name: s.name, r: 2.2 });
  c.series(seed2.map(step => [step.rollout, step['rollout/raw_reward_unfiltered']]), { hue: 'green', dash: 'dashed', name: 'raw reward seed 2' });
  c.series(seed3.map(step => [step.rollout, step['rollout/raw_reward_unfiltered']]), { hue: 'green', dash: 'dashed', name: 'raw reward seed 3' });
  legend(f, legendRows, 66, 22);
});
