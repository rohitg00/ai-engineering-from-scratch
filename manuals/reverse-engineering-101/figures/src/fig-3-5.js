'use strict';

const { figure } = require('../../../_shared/figkit.js');

const left = [
  '__TEXT 0x100000000 · 1280 B',
  '__text 0x100000500 · 576 B',
  '__stubs 0x100000740 · 48 B',
  '__cstring 0x100000770 · 96 B',
  '__const 0x1000007d0 · 64 B',
  '__unwind_info 0x100000810 · 14320 B',
  '__got 0x100004000 · 48 B',
  '__const 0x100004030 · 40 B',
  '__DATA_CONST 0x100004058 · 16296 B',
  '__LINKEDIT 0x100008000 · 1104 B',
  '__LINKEDIT 0x100008450 · 15280 B',
  'EXTERNAL 0x10000c000 · 512 B',
];
const right = [
  '.text 0x100000 · 159 B',
  '.rodata 0x1000a0 · 80 B',
  '.rodata.str1.1 0x1000f0 · 10 B',
  '.comment:0x0 · 47 B',
  '.rela.rodata:0x0 · 120 B',
  '.rela.text:0x0 · 72 B',
  '.strtab:0x0 · 190 B',
  '.symtab:0x0 · 312 B',
  '_elfHeader:0x0 · 64 B',
  '_elfSectionHeaders:0x0 · 704 B',
];

module.exports = figure('fig-3-5', {
  height: 346,
  title: 'The two overviews side by side',
  desc: 'Two columns. Left, the arm64 Mach-O executable: Ghidra document target-01b5d08b08fb.bin with 12 memory blocks, 13 procedures and 39 strings, listing every block from __TEXT at 0x100000000 to the EXTERNAL block at 0x10000c000. Right, the x86-64 ELF relocatable object: document target-9a4a8082ba5e.o with 10 blocks, 4 procedures and 20 strings, from .text at 0x100000 to _elfSectionHeaders in its own address space. Both records come from the rea-workflow provider with confidence derived.',
}, f => {
  f.kicker(20, 18, 'A · ledger-arm64-O1 · mach-o arm64');
  f.kicker(336, 18, 'B · ledger-x86_64-O1.o · elf x86_64');
  f.rule(320, 8, 320, 338, { dash: 'dashed' });
  f.box({ x: 20, y: 28, w: 284, h: 46, hue: 'green', title: 'target-01b5d08b08fb.bin', sub: '12 segments · 13 procedures · 39 strings' });
  f.box({ x: 336, y: 28, w: 284, h: 46, hue: 'green', title: 'target-9a4a8082ba5e.o', sub: '10 segments · 4 procedures · 20 strings' });
  left.forEach((line, index) => f.text(20, 100 + index * 16, line, { size: 11 }));
  right.forEach((line, index) => f.text(336, 100 + index * 16, line, { size: 11 }));
  f.box({ x: 20, y: 296, w: 284, h: 40, hue: 'violet', title: 'rea-workflow · confidence derived', titleSize: 12 });
  f.box({ x: 336, y: 296, w: 284, h: 40, hue: 'violet', title: 'rea-workflow · confidence derived', titleSize: 12 });
});
