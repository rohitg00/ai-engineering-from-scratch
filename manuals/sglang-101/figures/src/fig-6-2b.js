'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-6-2b', {
  height: 262,
  title: 'EP16 and EP32 at two batch sizes',
  desc: 'A two by two comparison of DeepSeek-R1 decode throughput on H20 from Ant Group. At batch 8, EP16 gave 278 tokens per second and EP32 gave 293. At batch 32, EP16 gave 675 and EP32 gave 585. About half of the MoE traffic stayed on NVLink at EP16 and about a quarter at EP32.',
}, f => {
  const cols = [
    { x: 180, title: '--ep-size 16', nv: 'about 50% on NVLink' },
    { x: 410, title: '--ep-size 32', nv: 'about 25% on NVLink' },
  ];
  const rows = [
    { y: 70, label: 'batch 8', values: ['278 tokens/s', '293 tokens/s'], win: 1 },
    { y: 138, label: 'batch 32', values: ['675 tokens/s', '585 tokens/s'], win: 0 },
  ];
  f.kicker(20, 22, 'DeepSeek-R1 decode on H20');
  for (const col of cols) f.box({ x: col.x, y: 32, w: 210, h: 30, hue: 'violet', title: col.title });
  for (const row of rows) {
    f.text(20, row.y + 34, row.label, { size: 12, weight: 700 });
    cols.forEach((col, index) => {
      const winner = index === row.win;
      f.box({ x: col.x, y: row.y, w: 210, h: 56, hue: winner ? 'plum' : 'grey', double: winner, title: row.values[index], sub: [winner ? 'faster at this batch' : 'slower at this batch'] });
    });
  }
  f.text(20, 228, 'MoE traffic', { size: 12, weight: 700 });
  for (const col of cols) f.text(col.x + 105, 228, col.nv, { size: 11, serif: true, hue: 'indigo', anchor: 'middle' });
  f.text(20, 252, 'Measured by Ant Group, LMSYS blog, 2025-09-26.', { size: 11, serif: true, hue: 'ink-soft' });
});
