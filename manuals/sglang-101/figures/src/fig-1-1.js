'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-1-1', {
  height: 330,
  title: 'Prefill against decode on the capture Mac',
  desc: 'Two columns from one benchmark run with one request at a time. On the left, prefill runs one forward pass over 512 prompt tokens, writes 512 KV entries, and returns the first token after a median of 162.98 ms, about 0.32 ms per prompt token. On the right, decode runs one forward pass for each of the next 127 tokens, reads every weight and every cached KV entry each time, and takes a mean of 4.38 ms per token.',
}, f => {
  f.kicker(20, 18, 'prefill · the whole prompt at once');
  f.kicker(336, 18, 'decode · one token per pass');
  f.rule(320, 8, 320, 298, { dash: 'dashed' });

  const p1 = f.box({ x: 20, y: 32, w: 284, h: 44, hue: 'olive', title: '512 prompt token ids', sub: 'random dataset, seed 7' });
  const p2 = f.box({ x: 20, y: 110, w: 284, h: 54, hue: 'plum', title: 'one forward pass', sub: ['512 tokens in one batch of matmuls'] });
  const p3 = f.box({ x: 20, y: 198, w: 284, h: 44, hue: 'green', title: '512 KV entries written', sub: 'kept for every later step' });
  f.arrow([162, p1.y + 44], [162, p2.y - 1], { style: 'call' });
  f.arrow([162, p2.y + 54], [162, p3.y - 1], { style: 'write' });
  f.text(20, 270, 'median TTFT 162.98 ms', { size: 12.5, weight: 700, hue: 'plum' });
  f.text(20, 290, 'about 0.32 ms for each prompt token', { size: 11.5, serif: true, hue: 'ink-soft' });

  const d1 = f.box({ x: 336, y: 32, w: 284, h: 44, hue: 'olive', title: '1 new token per request', sub: 'the token decode made last' });
  const d2 = f.box({ x: 336, y: 110, w: 284, h: 54, hue: 'plum', title: 'one forward pass', sub: ['reads every weight for one token'] });
  const d3 = f.box({ x: 336, y: 198, w: 284, h: 44, hue: 'green', title: 'reads 512 + n KV entries', sub: 'and writes one more' });
  f.arrow([478, d1.y + 44], [478, d2.y - 1], { style: 'call' });
  f.arrow([478, d3.y], [478, d2.y + 55], { style: 'reply' });
  f.text(336, 270, 'mean TPOT 4.38 ms', { size: 12.5, weight: 700, hue: 'plum' });
  f.text(336, 290, 'repeated for each of the next 127 tokens', { size: 11.5, serif: true, hue: 'ink-soft' });
  f.text(20, 316, 'Qwen3-0.6B-4bit · SGLang 0.5.22 on MLX', { size: 11, serif: true, hue: 'ink-mute' });
});
