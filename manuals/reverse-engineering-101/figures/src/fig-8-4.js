'use strict';

const { figure } = require('../../../_shared/figkit.js');

const observed = [
  { title: '_grade at 0x100000518, 60 bytes', sub: 'ev_41e8ca1c, procedure.body' },
  { title: 'divide by 10 via 0x66666667', sub: 'ev_2c883c7b and ev_41e8ca1c, assembly' },
  { title: 'five 4-byte entries at 0x1000007d0', sub: 'ev_41e8ca1c, cmp #0x4, ldr UXTW #0x2' },
  { title: 'one DATA reference, no call edge', sub: 'ev_41e8ca1c and ev_644b3495, 0x10000811a' },
  { title: 'F D C B A at 0x100000770 to 778', sub: 'ev_ad37f574, 39 strings' },
];
const open = [
  { title: 'the five table values', sub: 'read_bytes 0x1000007d0, length 20' },
  { title: 'five 8-byte entries at 0x1000007e8', sub: 'read_bytes 0x1000007e8, length 40' },
  { title: 'the letter for a score of 95', sub: 'both tables, then _labels at 0x100004030' },
  { title: 'who passes a score to _grade_label', sub: 'analyze_function entry' },
];

module.exports = figure('fig-8-4', {
  height: 290,
  title: 'What the session observed, and what stays unknown',
  desc: 'Two columns. The left column lists five observed claims with their Evidence ids: _grade at 0x100000518 is 60 bytes in ev_41e8ca1c, the divide by 10 through 0x66666667 in ev_2c883c7b and ev_41e8ca1c, five 4-byte entries at 0x1000007d0 from cmp #0x4 and ldr UXTW #0x2, one DATA reference from 0x10000811a and no call edge in ev_41e8ca1c and ev_644b3495, and the strings F D C B A at 0x100000770 to 0x100000778 in ev_ad37f574. The right column lists four open rows with the call that would close each: the five table values need read_bytes at 0x1000007d0 with length 20, the five 8-byte entries at 0x1000007e8 need read_bytes there with length 40, the letter for a score of 95 needs both tables and then _labels at 0x100004030, and who passes a score to _grade_label needs analyze_function on entry.',
}, f => {
  f.kicker(20, 18, 'observed, with the record', { hue: 'teal' });
  f.kicker(336, 18, 'open, with the call that closes it', { hue: 'rose' });
  f.rule(320, 8, 320, 282, { dash: 'dashed' });
  observed.forEach((item, index) => {
    f.box({ x: 20, y: 30 + index * 50, w: 284, h: 42, hue: 'teal', title: item.title, sub: item.sub, titleSize: 12 });
  });
  open.forEach((item, index) => {
    f.box({ x: 336, y: 30 + index * 50, w: 284, h: 42, hue: 'rose', dash: 'dashed', title: item.title, sub: item.sub, titleSize: 12 });
  });
});
