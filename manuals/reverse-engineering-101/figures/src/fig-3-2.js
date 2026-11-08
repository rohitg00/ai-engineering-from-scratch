'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-3-2', {
  height: 232,
  title: 'Two layout commands on the capture Mac',
  desc: 'Left: rea inspect-binary-layout on ledger-x86_64-O1.o reaches the pwntools-elf provider, which answers capability_unavailable with category unsupported_provider because its profile supports Linux x64 only, and the command exits 1. Right: rea inspect-macho on ledger-arm64-O1 reaches the native-macos provider, which runs lipo, otool, nm, dyld_info, dwarfdump, and vtool, found through xcrun, and returns an Evidence record with 17 load commands and 4 segments, exit 0.',
}, f => {
  f.kicker(20, 18, 'A · inspect-binary-layout');
  f.kicker(336, 18, 'B · inspect-macho');
  f.rule(320, 8, 320, 224, { dash: 'dashed' });
  const left = [
    { hue: 'blue', title: 'rea inspect-binary-layout', sub: 'fixtures/ledger-x86_64-O1.o' },
    { hue: 'blue', title: 'provider pwntools-elf', sub: 'needs Linux x64 and REA_PWNTOOLS_PYTHON' },
    { hue: 'rose', title: 'capability_unavailable', sub: 'unsupported_provider · exit 1', dash: 'dashed' },
  ];
  const right = [
    { hue: 'blue', title: 'rea inspect-macho', sub: 'fixtures/ledger-arm64-O1' },
    { hue: 'grey', title: 'otool nm dyld_info dwarfdump', sub: 'and lipo, vtool, found through xcrun' },
    { hue: 'green', title: 'Evidence ev_497834aa', sub: '17 load commands · 4 segments · exit 0' },
  ];
  [[left, 20, ['call', 'fail']], [right, 336, ['call', 'reply']]].forEach(([column, x, styles]) => {
    column.forEach((item, index) => {
      const y = 30 + index * 70;
      f.box({ x, y, w: 284, h: 46, ...item });
      if (index < column.length - 1) f.arrow([x + 142, y + 46], [x + 142, y + 69], { style: styles[index], packet: false });
    });
  });
});
