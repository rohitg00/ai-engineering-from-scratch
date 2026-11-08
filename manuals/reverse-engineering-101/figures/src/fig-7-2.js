'use strict';

const { figure } = require('../../../_shared/figkit.js');

const legOne = [
  { hue: 'green', title: 'ledger.c', sub: 'the original, compiled natively at -O1' },
  { hue: 'grey', title: 'percent_change_wide.c', sub: 'the candidate, renamed cand_percent_change' },
  { hue: 'grey', title: 'differential', sub: 'driver.c links both into one program' },
  { hue: 'grey', title: 'input grid', sub: '92 cells in 9 hazard classes' },
];
const legTwo = [
  { hue: 'green', title: 'ledger-x86_64-O1.o', sub: 'grade: 46 bytes, one R_X86_64_PC32' },
  { hue: 'grey', title: 'grade_switch.c', sub: 'clang -target x86_64-unknown-linux-gnu -O1' },
  { hue: 'grey', title: 'mask_relocations', sub: 'zero 4 bytes at offset 38 on both sides' },
  { hue: 'grey', title: 'relocation records', sub: '.rodata+0x10 and .rodata-0x4, same shape' },
];

module.exports = figure('fig-7-2', {
  height: 324,
  title: 'Two legs of one proof',
  desc: 'Two columns of boxes read top down. Leg one, execute and compare: ledger.c is the original compiled natively at -O1, percent_change_wide.c is the candidate renamed cand_percent_change, driver.c links both into one program named differential, the input grid has 92 cells in 9 hazard classes, and the results are 28 mismatches for the plausible pair and 0 for the equal pair. Leg two, recompile and compare: grade in ledger-x86_64-O1.o is 46 bytes with one R_X86_64_PC32 relocation, grade_switch.c is compiled with clang for x86_64-unknown-linux-gnu at -O1, mask_relocations zeroes 4 bytes at offset 38 on both sides, the relocation records .rodata+0x10 and .rodata-0x4 have the same shape, read_table gives 1, 2, 3, 4, 4 on both sides, and grade_case10_wrong gives 1, 2, 3, 4, 3.',
}, f => {
  f.kicker(20, 18, 'leg one: execute and compare');
  f.kicker(340, 18, 'leg two: recompile and compare');
  [[legOne, 20], [legTwo, 340]].forEach(([column, x]) => {
    const cx = x + 140;
    column.forEach((item, index) => {
      const y = 30 + index * 60;
      f.box({ x, y, w: 280, h: 40, hue: item.hue, title: item.title, sub: item.sub, titleSize: 12 });
      if (index < column.length - 1) f.arrow([cx, y + 40], [cx, y + 59], { style: 'call' });
    });
  });
  f.arrow([160, 250], [87, 269], { style: 'fail' });
  f.arrow([160, 250], [232, 269], { style: 'call' });
  f.box({ x: 20, y: 270, w: 135, h: 40, hue: 'rose', dash: 'dashed', title: 'plausible pair', sub: '28 mismatches', titleSize: 12 });
  f.box({ x: 165, y: 270, w: 135, h: 40, hue: 'teal', title: 'equal pair', sub: '0 mismatches', titleSize: 12 });
  f.arrow([480, 250], [403, 269], { style: 'call' });
  f.arrow([480, 250], [545, 269], { style: 'fail' });
  f.box({ x: 340, y: 270, w: 126, h: 40, hue: 'teal', title: 'read_table', sub: '1, 2, 3, 4, 4', titleSize: 12 });
  f.box({ x: 470, y: 270, w: 150, h: 40, hue: 'rose', dash: 'dashed', title: 'grade_case10_wrong', sub: '1, 2, 3, 4, 3', titleSize: 11 });
});
