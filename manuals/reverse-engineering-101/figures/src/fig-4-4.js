'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

const entry = [
  '0x100000518: mov w8, #0x6667',
  '0x10000051c: movk w8, #0x6666, LSL #16',
  '0x100000520: smull x8, w0, w8',
  '0x100000524: lsr x9, x8, #0x3f',
  '0x100000528: asr x8, x8, #0x22',
  '0x10000052c: add w8, w8, w9',
  '0x100000530: sub w8, w8, #0x6',
  '0x100000534: cmp w8, #0x4',
  '0x100000538: b.hi 0x10000054c',
];
const table = [
  '0x10000053c: adrp x9, 0x100000000',
  '0x100000540: add x9, x9, #0x7d0',
  '0x100000544: ldr w0, [x9, w8, UXTW #0x2]',
  '0x100000548: ret',
];
const fallback = [
  '0x10000054c: mov w0, #0x0',
  '0x100000550: ret',
];

module.exports = figure('fig-4-4', {
  height: 350,
  title: 'The three basic blocks of _grade',
  desc: 'A control-flow graph of three blocks from the basic_blocks facet. The entry block from 0x100000518 to 0x10000053c holds nine instructions: the constant 0x66666667, the signed multiply and shifts that divide by ten, the subtract of 6, and the compare with 4 followed by b.hi. One successor is the table block at 0x10000053c, which forms the address 0x1000007d0, loads one 32-bit word and returns. The other is the default block at 0x10000054c, which returns zero. Neither leaf block has a successor.',
}, f => {
  const block = (x, y, w, lines, kicker) => {
    f.rect(x, y, w, lines.length * 14 + 34, { fill: color('paper'), stroke: color('violet-ink') });
    f.kicker(x + 12, y + 16, kicker);
    lines.forEach((line, index) => f.text(x + 12, y + 32 + index * 14, line, { size: 11 }));
  };
  block(120, 20, 400, entry, 'block 0x100000518 to 0x10000053c');
  f.arrow([170, 180], [170, 239], { style: 'call', label: 'b.hi not taken', note: 'index 0 to 4', packet: false });
  f.arrow([470, 180], [470, 239], { style: 'call', label: 'b.hi taken', note: 'index above 4', packet: false });
  block(20, 240, 300, table, 'block 0x10000053c · table read');
  block(340, 240, 280, fallback, 'block 0x10000054c · default');
  f.text(20, 342, 'successors from basic_blocks: 0x518 → 0x53c and 0x54c · 0x53c → none · 0x54c → none', { size: 11, serif: true, hue: 'ink-soft' });
});
