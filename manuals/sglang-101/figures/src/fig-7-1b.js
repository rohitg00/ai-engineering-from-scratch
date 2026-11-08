'use strict';

const { figure } = require('../../../_shared/figkit.js');

const steps = [
  ['measure with sglang.benchmark.serving', 'TTFT, TPOT, and output tok/s at three concurrency levels · 5.1', 'olive'],
  ['--mem-fraction-static', 'size the KV pool for the machine you share · 3.2', 'green'],
  ['prompt order', 'shared text first, per-request text last, read cached_tokens · 3.4', 'green'],
  ['--max-running-requests', 'cap concurrency at the knee you measured · 5.1', 'amber'],
  ['--cuda-graph-backend-decode, --attention-backend', 'one change per run, after steps 1 to 4 · 4.1, 4.2', 'violet'],
  ['--tp-size, --dp-size, --attn-dp-size', 'only when one replica is saturated · 6.1', 'indigo'],
  ['--disaggregation-mode', 'only when prefill measurably delays decode · 6.3', 'indigo'],
];

module.exports = figure('fig-7-1b', {
  height: 452,
  title: 'The order to change SGLang settings',
  desc: 'Seven settings in the order this manual changes them: measure with sglang.benchmark.serving, size the KV pool, order the prompt, cap concurrency at the knee, then CUDA graphs and attention backends, then parallelism, and disaggregation last. Each row names the section that measures it.',
}, f => {
  steps.forEach(([title, sub, hue], index) => {
    const y = 14 + index * 62;
    f.step(30, y + 24, index + 1, { hue });
    f.box({ x: 52, y, w: 568, h: 48, hue, title, sub: [sub], align: 'left' });
    if (index < steps.length - 1) f.line(30, y + 34, 30, y + 75, { style: 'state', head: false });
  });
});
