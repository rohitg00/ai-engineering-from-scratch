'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const bytesPerToken = 36 * 8 * 128 * 2;
const perGiB = bytes => Math.floor(2 ** 30 / bytes);

module.exports = figure('fig-2-4', {
  height: 320,
  title: 'An FP8 KV cache holds twice the tokens in each GiB',
  desc: 'Computed KV cache tokens that fit in one GiB for Qwen3-8B, which has 36 layers, 8 KV heads and a head size of 128. BF16 uses 2 bytes per value, 144 KiB per token, and holds 7,281 tokens per GiB. FP8 uses 1 byte per value, 72 KiB per token, and holds 14,563 tokens per GiB. These numbers come from the formula, not from a run.',
}, f => {
  const c = chart(f, { x: 66, y: 50, w: 540, h: 200, yDomain: [0, 18000], xDomain: [0, 1], yTicks: [0, 6000, 12000, 18000], yFormat: v => v.toLocaleString('en-US'), yLabel: 'KV tokens per GiB' });
  c.bars([
    { name: 'BF16, 144 KiB per token', value: perGiB(bytesPerToken * 2), hue: 'grey', label: perGiB(bytesPerToken * 2).toLocaleString('en-US') },
    { name: 'FP8, 72 KiB per token', value: perGiB(bytesPerToken), hue: 'green', label: perGiB(bytesPerToken).toLocaleString('en-US') },
  ], { width: 110 });
  f.text(66, 306, 'Computed from the bytes per token. Our runs held the block count fixed.', { size: 11.5, serif: true, hue: 'ink-soft' });
});
