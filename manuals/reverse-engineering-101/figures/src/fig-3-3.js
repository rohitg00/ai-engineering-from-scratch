'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-3-3', {
  height: 456,
  title: 'The load image of ledger-arm64-O1',
  desc: 'Four LC_SEGMENT_64 commands drawn as rows from low to high address. __PAGEZERO at 0x0 spans 4 GiB with no file bytes. __TEXT at 0x100000000 maps file bytes 0 to 16384 and holds __text, __stubs, __cstring, __const and __unwind_info, and LC_MAIN points at entryoff 1488 inside it. __DATA_CONST at 0x100004000 maps bytes 16384 to 32768 and holds __got and __const. __LINKEDIT at 0x100008000 maps bytes 32768 to 33872 and holds the chained fixups, the exports trie, the function starts, the symbol and string tables, and the code signature.',
}, f => {
  f.kicker(20, 18, 'address');
  f.kicker(140, 18, 'segment and sections');
  f.kicker(540, 18, 'file offset');
  const rows = [
    { y: 30, h: 44, addr: '0x0', file: 'none', hue: 'grey', dash: 'dashed', title: '__PAGEZERO · 4 GiB reserved', sub: ['vmsize 4294967296 · filesize 0 · prot 0'] },
    { y: 86, h: 138, addr: '0x100000000', file: '0 to 16384', hue: 'green', title: '__TEXT · r-x', sub: ['__text 0x100000500 · 576 B · file 1280', '__stubs 0x100000740 · 48 B · file 1856', '__cstring 0x100000770 · 95 B · file 1904', '__const 0x1000007d0 · 64 B · file 2000', '__unwind_info 0x100000810 · 96 B · file 2064', 'LC_MAIN entryoff 1488 · entry at 0x1000005d0'] },
    { y: 236, h: 76, addr: '0x100004000', file: '16384 to 32768', hue: 'green', title: '__DATA_CONST · rw-', sub: ['__got 0x100004000 · 48 B · file 16384', '__const 0x100004030 · 40 B · file 16432'] },
    { y: 324, h: 122, addr: '0x100008000', file: '32768 to 33872', hue: 'green', title: '__LINKEDIT · r-- · no sections', sub: ['chained fixups file 32768 · 176 B', 'exports trie file 32944 · 104 B', 'function starts file 33048 · 8 B', 'symtab file 33056 · 13 symbols · strtab file 33304', 'code signature file 33456 · 416 B'] },
  ];
  for (const row of rows) {
    f.text(20, row.y + 16, row.addr, { size: 11 });
    f.box({ x: 140, y: row.y, w: 380, h: row.h, hue: row.hue, dash: row.dash, title: row.title, sub: row.sub, align: 'left' });
    f.text(540, row.y + 16, row.file, { size: 11, serif: true, hue: 'ink-soft' });
  }
});
