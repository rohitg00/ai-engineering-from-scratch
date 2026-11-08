'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-4-9', {
  height: 340,
  title: 'One row reduced in two batches',
  desc: 'Two columns. On the left, a default matrix multiply kernel reduces the same request row in two tiles when the batch has 1 request and in four tiles when the batch has 37 requests, so the partial sums add in different orders and the last bits of the result can differ. On the right, a batch-invariant kernel uses the same fixed split in both batches, so the result is the same bits in both.',
}, f => {
  f.kicker(20, 18, 'A · default kernel');
  f.kicker(336, 18, 'B · batch-invariant kernel');
  f.rule(320, 8, 320, 332, { dash: 'dashed' });
  const column = (x, rows) => {
    rows.forEach((row, index) => {
      const y = 34 + index * 140;
      f.text(x, y + 10, row.label, { size: 11, hue: 'ink-soft' });
      const tileW = (284 - (row.tiles - 1) * 6) / row.tiles;
      for (let t = 0; t < row.tiles; t += 1) f.rect(x + t * (tileW + 6), y + 20, tileW, 26, { hue: 'violet' });
      f.text(x, y + 66, `${row.tiles} partial sums, added in order`, { size: 11, serif: true, hue: 'ink-soft' });
      f.box({ x, y: y + 76, w: 284, h: 36, hue: row.hue, title: row.result, titleSize: 12, dash: row.dash });
    });
  };
  column(20, [
    { label: 'batch of 1', tiles: 2, result: 'logit x', hue: 'plum' },
    { label: 'batch of 37', tiles: 4, result: 'logit x, last bits can differ', hue: 'rose', dash: 'dashed' },
  ]);
  column(336, [
    { label: 'batch of 1', tiles: 4, result: 'logit x', hue: 'plum' },
    { label: 'batch of 37', tiles: 4, result: 'logit x, same bits', hue: 'plum' },
  ]);
});
