'use strict';

const { figure } = require('../../../_shared/figkit.js');

const rows = [
  ['0x1000006a0', '_percent_change', '0x100000500 · 24 B', '0x100008118', 'delta 0x500'],
  [null, '_grade', '0x100000518 · 60 B', '0x10000811a', 'delta 0x18'],
  ['0x1000006bc', '_total', '0x100000554 · 52 B', '0x10000811b', 'delta 0x3c'],
  ['0x1000006ec', '_grade_label', '0x100000588 · 72 B', '0x10000811c', 'delta 0x34'],
];

module.exports = figure('fig-4-6', {
  height: 310,
  title: 'Every reference to the four ledger functions',
  desc: 'Four rows, one per function. In the middle, the function with its entry and body size. On the left, the call site inside entry that reaches it: 0x1000006a0 for _percent_change, 0x1000006bc for _total, 0x1000006ec for _grade_label, and none for _grade because its body was inlined into _grade_label. On the right, the LC_FUNCTION_STARTS entry that refers to it as data: 0x100008118, 0x10000811a, 0x10000811b and 0x10000811c, with ULEB128 deltas 0x500, 0x18, 0x3c and 0x34.',
}, f => {
  f.kicker(20, 18, 'call sites in entry');
  f.kicker(230, 18, 'function');
  f.kicker(420, 18, 'LC_FUNCTION_STARTS entries');
  rows.forEach(([call, name, sub, start, delta], index) => {
    const y = 36 + index * 66;
    const fn = f.box({ x: 230, y, w: 180, h: 50, hue: 'violet', title: name, sub });
    if (call) {
      const site = f.box({ x: 20, y, w: 180, h: 50, hue: 'green', title: `entry ${call}`, sub: 'UNCONDITIONAL_CALL' });
      f.arrow(site.right(), [fn.x - 1, fn.cy], { style: 'call', packet: false });
    } else {
      f.box({ x: 20, y, w: 180, h: 50, hue: 'grey', dash: 'dashed', title: 'no call site', sub: 'inlined into _grade_label' });
    }
    const entry = f.box({ x: 440, y, w: 180, h: 50, hue: 'green', title: start, sub: `${delta} · DATA` });
    f.arrow(entry.left(), [fn.x + fn.w + 1, fn.cy], { style: 'call', packet: false });
  });
});
