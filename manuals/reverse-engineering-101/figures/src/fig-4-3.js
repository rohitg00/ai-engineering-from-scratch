'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

const rows = [
  ['EXTERNAL:0x1', '___stack_chk_fail', '', 'external · libSystem.B.dylib', 'grey'],
  ['EXTERNAL:0x2', '_atoi', '', 'external · libSystem.B.dylib', 'grey'],
  ['EXTERNAL:0x3', '_fwrite', '', 'external · libSystem.B.dylib', 'grey'],
  ['EXTERNAL:0x4', '_printf', '', 'external · libSystem.B.dylib', 'grey'],
  ['0x100000500', '_percent_change', '24 B', 'body 0x500 to 0x517, ledger.c', 'green'],
  ['0x100000518', '_grade', '60 B', 'body 0x518 to 0x553, ledger.c', 'green'],
  ['0x100000554', '_total', '52 B', 'body 0x554 to 0x587, ledger.c', 'green'],
  ['0x100000588', '_grade_label', '72 B', 'body 0x588 to 0x5cf, ledger.c', 'green'],
  ['0x1000005d0', 'entry', '368 B', 'body 0x5d0 to 0x73f · LC_MAIN', 'green'],
  ['0x100000740', '___stack_chk_fail', '12 B', 'thunk to EXTERNAL:0x1 in __stubs', 'violet'],
  ['0x10000074c', '_atoi', '12 B', 'thunk to EXTERNAL:0x2 in __stubs', 'violet'],
  ['0x100000758', '_fwrite', '12 B', 'thunk to EXTERNAL:0x3 in __stubs', 'violet'],
  ['0x100000764', '_printf', '12 B', 'thunk to EXTERNAL:0x4 in __stubs', 'violet'],
];

module.exports = figure('fig-4-3', {
  height: 400,
  title: 'The thirteen procedures of ledger-arm64-O1',
  desc: 'Thirteen rows sorted by address. Four external functions at EXTERNAL:0x1 to 0x4 from libSystem. Five internal functions in __text: _percent_change at 0x100000500 with 24 bytes, _grade at 0x100000518 with 60, _total at 0x100000554 with 52, _grade_label at 0x100000588 with 72, and entry at 0x1000005d0 with 368. Four thunks of 12 bytes each in __stubs from 0x100000740, each resolved to one external. The internal bodies add up to 576 bytes, the size of __text.',
}, f => {
  f.kicker(20, 18, 'address');
  f.kicker(150, 18, 'name');
  f.kicker(330, 18, 'body');
  f.kicker(410, 18, 'classification');
  rows.forEach(([address, name, body, kind, hue], index) => {
    const y = 28 + index * 26;
    f.rect(20, y, 600, 26, { fill: color(`${hue}-fill`), stroke: color('panel-edge') });
    f.text(28, y + 17, address, { size: 11 });
    f.text(150, y + 17, name, { size: 11, weight: 700 });
    if (body) f.text(330, y + 17, body, { size: 11 });
    f.text(410, y + 17, kind, { size: 11, serif: true, hue: 'ink-soft' });
  });
  f.text(20, 390, 'internal bodies 24 + 60 + 52 + 72 + 368 = 576 bytes, the size of __text · stubs 4 × 12 = 48 bytes', { size: 11, serif: true, hue: 'ink-soft' });
});
