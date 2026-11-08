'use strict';

const { figure } = require('../../../_shared/figkit.js');

const rows = [
  { y: 30, check: 'size', hue: 'grey', fails: [['percent_change_wide', '16 vs 26 bytes', 210, 30], ['percent_change_div_first', '16 vs 18 bytes', 420, 30], ['grade_thresholds', '46 vs 39 bytes, 0 relocations', 210, 72]] },
  { y: 110, check: 'masked bytes', hue: 'grey', fails: [] },
  { y: 180, check: 'relocation records', hue: 'grey', fails: [] },
  { y: 250, check: 'referenced constants', hue: 'grey', fails: [['grade_case10_wrong', '1, 2, 3, 4, 4 vs 1, 2, 3, 4, 3', 210, 250]] },
];
const passed = [
  ['percent_change_mul_first', '16 bytes, no relocation', 210, 320],
  ['percent_change_split', '16 bytes, no relocation', 420, 320],
  ['grade_switch', '46 bytes, table 1, 2, 3, 4, 4', 210, 362],
  ['grade_table', '46 bytes, table 1, 2, 3, 4, 4', 420, 362],
];

module.exports = figure('fig-7-3', {
  height: 412,
  title: 'Where each of the eight candidates stops',
  desc: 'Four checks run top down on the left: size, masked bytes, relocation records, and referenced constants, then a pass box. To the right of the size check, three candidates stop: percent_change_wide with 16 against 26 bytes, percent_change_div_first with 16 against 18 bytes, and grade_thresholds with 46 against 39 bytes and 1 against 0 relocations. No candidate stops at masked bytes or at relocation records. At referenced constants, grade_case10_wrong stops with the tables 1, 2, 3, 4, 4 against 1, 2, 3, 4, 3. Four candidates pass: percent_change_mul_first and percent_change_split with 16 bytes and no relocation, and grade_switch and grade_table with 46 bytes and the table 1, 2, 3, 4, 4.',
}, f => {
  rows.forEach((row, index) => {
    f.box({ x: 20, y: row.y, w: 170, h: 40, hue: row.hue, title: row.check, titleSize: 12 });
    const next = index + 1 < rows.length ? rows[index + 1].y : 320;
    f.arrow([105, row.y + 40], [105, next - 1], { style: 'call', label: 'equal', labelSize: 11 });
    if (row.fails.length === 0) {
      f.box({ x: 210, y: row.y + 2, w: 200, h: 36, hue: 'grey', dash: 'dashed', title: 'no candidate stops here', titleSize: 11 });
    }
    for (const [title, sub, x, y] of row.fails) {
      f.box({ x, y, w: 200, h: 36, hue: 'rose', dash: 'dashed', title, sub, titleSize: 11, pad: 8 });
    }
    f.arrow([190, row.y + 20], [209, row.y + 20], { style: row.fails.length ? 'fail' : 'reply' });
  });
  f.box({ x: 20, y: 320, w: 170, h: 40, hue: 'teal', title: 'pass', titleSize: 12 });
  f.arrow([190, 340], [209, 340], { style: 'reply' });
  for (const [title, sub, x, y] of passed) {
    f.box({ x, y, w: 200, h: 36, hue: 'teal', title, sub, titleSize: 11, pad: 8 });
  }
});
