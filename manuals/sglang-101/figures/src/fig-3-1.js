'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-3-1', {
  height: 250,
  title: 'What one token costs in Qwen3-0.6B',
  desc: 'Five factors from the Qwen3-0.6B config multiply to 114,688 bytes per token: 2 for key and value, 28 layers, 8 KV heads, a head dimension of 128, and 2 bytes for bfloat16. The startup log prints the same number as bytes_per_slot, and 181,574 slots of that size make a pool of 20.82 GB, which is 19.39 GiB.',
}, f => {
  f.kicker(20, 20, 'one token, five factors');
  const factors = [
    ['2', 'K and V'],
    ['28', 'layers'],
    ['8', 'KV heads'],
    ['128', 'head dim'],
    ['2 B', 'bfloat16'],
  ];
  factors.forEach(([value, label], index) => {
    const x = 20 + index * 94;
    f.box({ x, y: 34, w: 80, h: 56, hue: index === 4 ? 'violet' : 'green', title: value, sub: [label], titleSize: 16 });
    if (index < factors.length - 1) f.text(x + 87, 68, '×', { size: 14, anchor: 'middle', hue: 'ink-soft' });
  });
  f.text(484, 68, '=', { size: 16, anchor: 'middle', hue: 'ink-soft' });
  f.box({ x: 500, y: 34, w: 120, h: 56, hue: 'green', title: '114,688 B', sub: ['112 KiB'], titleSize: 13 });
  f.kicker(20, 124, 'the same number in the startup log');
  f.box({ x: 20, y: 134, w: 600, h: 44, hue: 'blue', title: 'Auto-sized attention KV pool', sub: ['kv_budget=19.39 GB · bytes_per_slot=114688 · pool_size=181574'], align: 'left' });
  f.kicker(20, 206, 'pool size');
  f.text(20, 228, '181,574 slots × 114,688 bytes = 20.82 GB, or 19.39 GiB, of KV', { size: 12, serif: true });
});
