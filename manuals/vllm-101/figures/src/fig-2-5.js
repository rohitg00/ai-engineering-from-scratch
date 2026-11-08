'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/gpu/summary/l4.json')).load;
const at = (key, field) => runs[key].points.find(p => p.x === 32)[field].median;

module.exports = figure('fig-2-5', {
  height: 330,
  title: 'FP8 weights at 32 users with the clock locked at 900 MHz',
  desc: 'Qwen3-8B in BF16 against Qwen3-8B-FP8 on an NVIDIA L4 at 32 users, SM clock locked at 900 MHz, KV pool fixed at 24,096 tokens, two seeds. Output was 208.8 tokens per second for BF16 and 284.7 for FP8. The median time per token was 119.9 ms for BF16 and 83.8 ms for FP8.',
}, f => {
  f.text(66, 30, 'output tok/s, higher is better', { size: 12, hue: 'ink' });
  const a = chart(f, { x: 66, y: 50, w: 220, h: 210, yDomain: [0, 400], xDomain: [0, 1], yTicks: [0, 200, 400], yLabel: '' });
  a.bars([
    { name: 'BF16', value: at('vllm-lock-b', 'output_throughput'), hue: 'grey', label: at('vllm-lock-b', 'output_throughput').toFixed(1) },
    { name: 'FP8', value: at('vllm-lock-fp8', 'output_throughput'), hue: 'green', label: at('vllm-lock-fp8', 'output_throughput').toFixed(1) },
  ], { width: 60 });
  f.text(366, 30, 'median ms per token, lower is better', { size: 12, hue: 'ink' });
  const b = chart(f, { x: 366, y: 50, w: 220, h: 210, yDomain: [0, 150], xDomain: [0, 1], yTicks: [0, 50, 100, 150], yLabel: '' });
  b.bars([
    { name: 'BF16', value: at('vllm-lock-b', 'median_tpot_ms'), hue: 'grey', label: at('vllm-lock-b', 'median_tpot_ms').toFixed(1) },
    { name: 'FP8', value: at('vllm-lock-fp8', 'median_tpot_ms'), hue: 'green', label: at('vllm-lock-fp8', 'median_tpot_ms').toFixed(1) },
  ], { width: 60 });
  f.text(66, 312, 'Both runs at 32 users with the same KV pool. Median of two seeds.', { size: 11.5, serif: true, hue: 'ink-soft' });
});
