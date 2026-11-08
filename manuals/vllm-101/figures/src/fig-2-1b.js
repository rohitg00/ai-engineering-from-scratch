'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-2-1b', {
  height: 236,
  title: 'The pool in tokens decides how many users fit',
  desc: 'On the L4 the pool held 24,096 tokens. The startup line reports 2.94 users because it assumes every user fills the full 8,192-token context. With 512 prompt tokens and 128 output tokens, each user holds 640 tokens, so 37 users fit.',
}, f => {
  f.kicker(20, 18, 'KV pool on the L4, Qwen3-8B');
  f.rect(20, 28, 600, 34, { hue: 'green' });
  f.text(320, 50, '24,096 tokens, 3.31 GiB at 144 KiB each', { size: 12, weight: 700, anchor: 'middle', hue: 'green' });
  f.kicker(20, 92, 'if every user fills 8,192 tokens');
  const full = 600 * 8192 / 24096;
  for (let i = 0; i < 2; i += 1) f.rect(20 + i * full, 100, full - 3, 30, { hue: 'blue' });
  f.rect(20 + 2 * full, 100, 600 - 2 * full, 30, { hue: 'grey', dash: 'dashed' });
  f.text(20, 148, 'Maximum concurrency 2.94x, the number the startup line prints', { size: 11.5, serif: true, hue: 'ink-soft' });
  f.kicker(20, 176, 'if each user holds 640 tokens');
  const small = 600 * 640 / 24096;
  for (let i = 0; i < 37; i += 1) f.rect(20 + i * small, 184, small - 2, 22, { hue: 'blue' });
  f.text(20, 226, '37 users fit, each with 512 prompt and 128 output tokens', { size: 11.5, serif: true, hue: 'ink-soft' });
});
