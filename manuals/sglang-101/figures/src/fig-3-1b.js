'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-3-1b', {
  height: 300,
  title: 'Request rows point into one slot pool',
  desc: 'Two ReqToTokenPool rows, request A and request B, each list KV slot indices. Both rows start with the same slots 1 to 4 for the shared system prompt, then point to their own slots for their questions. The KV pool strip below shows slots 1 to 4 stored once and used by both rows, and the free list hands out new slots.',
}, f => {
  f.kicker(20, 20, 'ReqToTokenPool rows');
  const rows = [
    { y: 34, name: 'request A', cells: ['1', '2', '3', '4', '5', '6'] },
    { y: 80, name: 'request B', cells: ['1', '2', '3', '4', '7', '8'] },
  ];
  for (const row of rows) {
    f.text(20, row.y + 22, row.name, { size: 12 });
    row.cells.forEach((cell, index) => {
      const shared = index < 4;
      f.box({ x: 120 + index * 52, y: row.y, w: 46, h: 34, hue: shared ? 'green' : 'blue', title: cell, titleSize: 12 });
    });
  }
  f.text(440, 56, 'cells hold slot indices', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(440, 102, 'positions 0 to 5', { size: 11, serif: true, hue: 'ink-soft' });
  f.kicker(20, 150, 'KV pool slots');
  const slots = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  slots.forEach((slot, index) => {
    const x = 20 + index * 60;
    const shared = index >= 1 && index <= 4;
    const used = index >= 5 && index <= 8;
    const hue = index === 0 ? 'grey' : shared ? 'green' : used ? 'blue' : 'grey';
    f.box({ x, y: 160, w: 54, h: 40, hue, dash: index === 0 || index === 9 ? 'dashed' : undefined, title: slot, titleSize: 12 });
  });
  f.text(20, 222, 'slot 0: padding, never given out', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 242, 'slots 1 to 4: the shared system prompt, stored once and read by both rows', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 262, 'slots 5 to 8: each request’s own question tokens', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 282, 'slot 9: on the TokenToKVPoolAllocator free list', { size: 11, serif: true, hue: 'ink-soft' });
});
