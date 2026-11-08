'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/gpu/summary/gb10.json')).mixed;
const at = (key, field) => runs[key].points.find(p => p.x === 0.5)[field].median;
const bar = (key, field, name, hue) => ({ name, value: at(key, field), hue, label: Math.round(at(key, field)).toLocaleString('en-US') });

module.exports = figure('fig-3-3', {
  height: 330,
  title: 'A larger token budget at 0.5 requests per second on the DGX Spark',
  desc: 'vLLM with Qwen3-30B-A3B on an NVIDIA GB10, prompts of 1,024 to 4,096 tokens, 64 to 256 output tokens, 0.5 requests per second, three seeds. With a budget of 2,048 tokens, the median first token took 1,145 ms and the P99 ITL was 574 ms. With 16,384 tokens, the first token took 906 ms and the P99 ITL was 798 ms.',
}, f => {
  f.text(66, 30, 'median first token, ms', { size: 12, hue: 'ink' });
  const a = chart(f, { x: 66, y: 50, w: 220, h: 210, yDomain: [0, 1500], xDomain: [0, 1], yTicks: [0, 750, 1500], yFormat: v => v.toLocaleString('en-US'), yLabel: '' });
  a.bars([bar('vllm-mnbt-2048', 'median_ttft_ms', '2,048', 'grey'), bar('vllm-mnbt-16384', 'median_ttft_ms', '16,384', 'blue')], { width: 60 });
  f.text(366, 30, 'P99 ITL, ms', { size: 12, hue: 'ink' });
  const b = chart(f, { x: 366, y: 50, w: 220, h: 210, yDomain: [0, 1000], xDomain: [0, 1], yTicks: [0, 500, 1000], yFormat: v => v.toLocaleString('en-US'), yLabel: '' });
  b.bars([bar('vllm-mnbt-2048', 'p99_itl_ms', '2,048', 'grey'), bar('vllm-mnbt-16384', 'p99_itl_ms', '16,384', 'blue')], { width: 60 });
  f.text(66, 312, 'Lower is better on both. Bars are labelled by --max-num-batched-tokens.', { size: 11.5, serif: true, hue: 'ink-soft' });
});
