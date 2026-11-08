'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

const source = [
  'int percent_change(int before, int after) {',
  '    if (before == 0) return 0;',
  '    return (after - before) * 100 / before;',
  '}',
];
const pseudo = [
  'ulong _percent_change(ulong param_1,int param_2)',
  '{',
  '  uint uVar1;',
  '  int iVar2;',
  '  iVar2 = (int)param_1;',
  '  if (iVar2 != 0) {',
  '    uVar1 = 0;',
  '    if (iVar2 != 0) {',
  '      uVar1 = ((param_2 - iVar2) * 100) / iVar2;',
  '    }',
  '    param_1 = (ulong)uVar1;',
  '  }',
  '  return param_1;',
  '}',
];

module.exports = figure('fig-4-9', {
  height: 356,
  title: 'percent_change as written and as decompiled',
  desc: 'Two blocks. The top block is the four-line C source of percent_change from ledger.c. The bottom block is the fourteen-line Ghidra pseudocode of _percent_change from the analyze_function record. Three lines are marked in rose: the ulong return type where the ABI returns four bytes, the second test of iVar2 that repeats a value tested once, and the return of param_1, the whole register, where the source returns an int.',
}, f => {
  f.kicker(20, 18, 'ledger.c · what you wrote');
  f.rect(20, 26, 600, 72, { fill: color('green-fill'), stroke: color('green-ink') });
  source.forEach((line, index) => f.text(32, 44 + index * 14, line, { size: 11 }));
  f.kicker(20, 122, 'ghidra 12.1.4 pseudocode · _percent_change');
  f.rect(20, 130, 600, 216, { fill: color('paper'), stroke: color('violet-ink') });
  pseudo.forEach((line, index) => f.text(32, 148 + index * 14, line, { size: 11 }));
  const mark = (lineIndex, text) => {
    const y = 148 + lineIndex * 14;
    f.rule(360, y - 4, 384, y - 4, { hue: 'rose' });
    f.text(392, y, text, { size: 11, serif: true, hue: 'rose' });
  };
  mark(0, 'ulong return, the ABI says 4 bytes');
  mark(7, 'second test of a value tested once');
  mark(12, 'returns param_1, source returns int');
});
