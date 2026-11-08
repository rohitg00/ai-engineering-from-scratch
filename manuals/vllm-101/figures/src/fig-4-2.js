'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/gpu/summary/l4-gpu1.json')).load;
const tpot = (key, x) => runs[key].points.find(p => p.x === x).median_tpot_ms.median;

module.exports = figure('fig-4-2', {
  height: 320,
  title: 'N-gram speculation cut the time per token to about a third for one user',
  desc: 'Median time per output token on an NVIDIA L4 with Qwen3-8B, a small KV pool, two seeds, random prompts. At one user, 241.7 ms without speculation and 76.6 ms with n-gram. At four users, 272.6 ms and 101.3 ms. The GPU ran at 375 to 443 MHz in all four runs.',
}, f => {
  const c = chart(f, { x: 66, y: 50, w: 540, h: 200, yDomain: [0, 300], xDomain: [0, 1], yTicks: [0, 100, 200, 300], yLabel: 'median ms per token' });
  c.bars([
    { name: '1 user, none', value: tpot('vllm-fast-b', 1), hue: 'grey', label: '241.7' },
    { name: '1 user, n-gram', value: tpot('vllm-ngram', 1), hue: 'green', label: '76.6' },
    { name: '4 users, none', value: tpot('vllm-fast-b', 4), hue: 'grey', label: '272.6' },
    { name: '4 users, n-gram', value: tpot('vllm-ngram', 4), hue: 'green', label: '101.3' },
  ], { width: 70 });
  f.text(66, 306, 'Lower is faster. Random prompts, acceptance counters not recorded.', { size: 11.5, serif: true, hue: 'ink-soft' });
});
