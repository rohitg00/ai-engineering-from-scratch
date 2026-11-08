'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/gpu/summary/l4.json')).load;
const out = (key, x) => runs[key].points.find(p => p.x === x).output_throughput.median;
const bar = (key, x, name, hue) => ({ name, value: out(key, x), hue, label: out(key, x).toFixed(1) });

module.exports = figure('fig-4-1', {
  height: 344,
  title: 'EAGLE3 output at 1 and 32 users with the clock locked at 900 MHz',
  desc: 'Median output tokens per second on an NVIDIA L4 with Qwen3-8B and the SM clock locked at 900 MHz, two seeds per bar, 2026-10-22. At one user, draft depth 1 gave 22.4, depth 3 gave 31.3, and depth 5 gave 31.7 tokens per second. The run with no speculation at one user is not shown, because its clock fell to 210 MHz. At 32 users, no speculation gave 208.8, depth 1 gave 271.1, depth 3 gave 333.6, and depth 5 gave 289.5 tokens per second.',
}, f => {
  f.text(66, 30, '1 user, output tok/s', { size: 12, hue: 'ink' });
  const a = chart(f, { x: 66, y: 50, w: 210, h: 210, yDomain: [0, 40], xDomain: [0, 1], yTicks: [0, 20, 40], yLabel: '' });
  a.bars([
    bar('vllm-lock-eagle3-k1', 1, 'k = 1', 'blue'),
    bar('vllm-lock-eagle3-k3', 1, 'k = 3', 'green'),
    bar('vllm-lock-eagle3-k5', 1, 'k = 5', 'violet'),
  ], { width: 40 });
  f.text(356, 30, '32 users, output tok/s', { size: 12, hue: 'ink' });
  const b = chart(f, { x: 356, y: 50, w: 250, h: 210, yDomain: [0, 400], xDomain: [0, 1], yTicks: [0, 200, 400], yLabel: '' });
  b.bars([
    bar('vllm-lock-b', 32, 'none', 'grey'),
    bar('vllm-lock-eagle3-k1', 32, 'k = 1', 'blue'),
    bar('vllm-lock-eagle3-k3', 32, 'k = 3', 'green'),
    bar('vllm-lock-eagle3-k5', 32, 'k = 5', 'violet'),
  ], { width: 40 });
  f.text(66, 306, 'Higher is better. k is the draft depth.', { size: 11.5, serif: true, hue: 'ink-soft' });
  f.text(66, 324, 'The 1-user run with no speculation is left out: its clock fell to 210 MHz.', { size: 11.5, serif: true, hue: 'ink-soft' });
});
