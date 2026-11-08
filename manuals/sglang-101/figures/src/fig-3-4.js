'use strict';

const { figure } = require('../../../_shared/figkit.js');

const WIDTH = 440;

module.exports = figure('fig-3-4', {
  height: 300,
  title: 'The same tokens in three orders',
  desc: 'Three token ribbons for prompts of about 3,000 tokens. The stable prompt reuses 2,998 tokens and computes 1, with a median first-token time of 45 ms. With a random ID at the start, only 5 tokens are reused and about 3,029 are computed, at 1,255 ms. With the same ID at the end, 2,985 tokens are reused and about 45 are computed, at 88 ms.',
}, f => {
  f.rect(20, 14, 14, 12, { hue: 'green' });
  f.text(40, 24, 'reused from the radix cache', { size: 11.5 });
  f.rect(260, 14, 14, 12, { hue: 'plum' });
  f.text(280, 24, 'computed in prefill', { size: 11.5 });
  const rows = [
    { name: 'stable system prompt', cached: 2998, total: 2999, ttft: '45 ms' },
    { name: 'random ID at the start', cached: 5, total: 3034, ttft: '1,255 ms' },
    { name: 'random ID at the end', cached: 2985, total: 3028, ttft: '88 ms' },
  ];
  rows.forEach((row, index) => {
    const y = 56 + index * 76;
    f.kicker(20, y, row.name);
    const cachedWidth = Math.max(3, (row.cached / row.total) * WIDTH);
    const newWidth = Math.max(3, WIDTH - cachedWidth);
    f.rect(20, y + 10, cachedWidth, 30, { hue: 'green' });
    f.rect(20 + cachedWidth, y + 10, newWidth, 30, { hue: 'plum' });
    f.text(474, y + 22, `${row.cached.toLocaleString('en-US')} cached`, { size: 11.5 });
    f.text(474, y + 38, `median TTFT ${row.ttft}`, { size: 11.5, serif: true, hue: 'ink-soft' });
  });
  f.text(20, 282, 'Every token after the first difference is a new branch of the tree.', { size: 11.5, serif: true, hue: 'ink-soft' });
});
