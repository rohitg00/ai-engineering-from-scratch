'use strict';

const { figure } = require('../../../_shared/figkit.js');

const rows = [
  { model: 'Qwen/Qwen3-8B', layers: '36', heads: '8', dim: '128', total: '144 KiB' },
  { model: 'Qwen3-30B-A3B', layers: '48', heads: '4', dim: '128', total: '96 KiB' },
];

module.exports = figure('fig-2-1', {
  height: 230,
  title: 'The bytes one token holds in the KV cache',
  desc: 'Bytes per token are layers times KV heads times head dimension times two, for keys and values, times two bytes for BF16. Qwen3-8B has 36 layers, 8 KV heads and dimension 128, so 144 KiB. Qwen3-30B-A3B has 48 layers and 4 KV heads, so 96 KiB.',
}, f => {
  const cols = [['layers', 170], ['KV heads', 260], ['head dim', 350], ['K and V', 440], ['BF16 bytes', 530]];
  cols.forEach(([name, x]) => f.kicker(x, 30, name, { anchor: 'middle' }));
  f.kicker(20, 30, 'model');
  rows.forEach((r, index) => {
    const y = 48 + index * 70;
    f.box({ x: 20, y, w: 116, h: 44, hue: 'violet', title: r.model.replace('Qwen/', ''), titleSize: 11.5 });
    [[r.layers, 170], [r.heads, 260], [r.dim, 350], ['2', 440], ['2', 530]].forEach(([v, x], i) => {
      f.box({ x: x - 30, y, w: 60, h: 44, hue: 'green', title: v });
      if (i < 4) f.text(x + 45, y + 27, 'x', { size: 12, anchor: 'middle', hue: 'ink-soft' });
    });
    f.text(20, y + 62, `${r.total} for every token of every user`, { size: 11.5, weight: 700, hue: 'green' });
  });
});
