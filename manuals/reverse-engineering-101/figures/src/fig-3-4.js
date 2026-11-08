'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-3-4', {
  height: 230,
  title: 'From 0x100000518 to file offset 1304',
  desc: 'Three rows. The __TEXT segment has vmaddr 0x100000000 and fileoff 0, so address minus vmaddr plus fileoff is 0x518, which is 1304. The __text section has address 0x100000500 and file_offset 1280, so 1280 plus 24 is 1304. The rea tool address_to_file_offset asks Ghidra for its one source mapping and answers file_offset 1304, where the bytes e8 cc 8c 52 encode mov w8, #0x6667.',
}, f => {
  f.kicker(20, 18, 'what the file says');
  f.kicker(340, 18, 'the offset');
  const rows = [
    [{ hue: 'green', title: '__TEXT segment', sub: 'vmaddr 0x100000000 · fileoff 0' }, { hue: 'grey', title: 'address - vmaddr + fileoff', sub: '0x100000518 - 0x100000000 + 0 = 0x518' }],
    [{ hue: 'green', title: '__text section', sub: 'address 0x100000500 · file_offset 1280' }, { hue: 'grey', title: 'file_offset + (address - addr)', sub: '1280 + (0x518 - 0x500) = 1280 + 24' }],
    [{ hue: 'violet', title: 'address_to_file_offset', sub: 'Ghidra source mapping, exactly one' }, { hue: 'teal', title: 'file_offset 1304', sub: 'bytes e8 cc 8c 52 · mov w8, #0x6667' }],
  ];
  rows.forEach(([left, right], index) => {
    const y = 30 + index * 68;
    const a = f.box({ x: 20, y, w: 280, h: 50, ...left });
    const b = f.box({ x: 340, y, w: 280, h: 50, ...right });
    f.arrow(a.right(), [b.x - 1, a.cy], { style: index === 2 ? 'reply' : 'call', packet: false });
    if (index < 2) f.arrow([480, y + 50], [480, y + 67], { style: 'call', packet: false });
  });
});
