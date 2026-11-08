'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-5-5', {
  height: 296,
  title: 'One bundle from the MCP session to four readers',
  desc: 'Left: the MCP session on ledger-arm64-O1 holds eight records and no unknowns, and export_evidence_bundle writes them. Middle: bundle-O1.json, 178,853 bytes as written, 178,398 bytes in the masked kit copy, seven arrays of canonical JSON. Right: four readers. rea inspect-evidence-bundle prints eight rows and zero unknown revisions. rea evidence-export writes canonical-O1.json with 178,397 bytes and the same JSON. rea evidence-import validates it and reports imported 8 and total 8. import_evidence_bundle in the O2 MCP session reports imported 6 and total 15, because two of the eight records were already in that ledger.',
}, f => {
  f.kicker(20, 18, 'the ledger');
  f.kicker(260, 18, 'the file');
  f.kicker(440, 18, 'the readers');
  const session = f.box({ x: 20, y: 62, w: 180, h: 72, hue: 'indigo', title: 'MCP session, O1', sub: ['8 records, 0 unknowns', 'ledger of one connection'] });
  const bundle = f.box({ x: 260, y: 62, w: 160, h: 72, hue: 'teal', title: 'bundle-O1.json', sub: ['178,853 bytes written', 'kit copy 178,398 bytes', '7 arrays, canonical'] });
  f.arrow(session.right(), [bundle.x - 1, session.cy], { style: 'write', label: 'export' });
  const readers = [
    { y: 28, hue: 'blue', title: 'inspect-evidence-bundle', sub: '8 rows, 0 unknowns' },
    { y: 88, hue: 'blue', title: 'evidence-export', sub: ['178,397 bytes, same JSON', 'sha256 47160c2d'] },
    { y: 148, hue: 'blue', title: 'evidence-import', sub: 'imported 8, total 8' },
    { y: 208, hue: 'indigo', title: 'import_evidence_bundle', sub: ['into the O2 session', 'imported 6, total 15'] },
  ];
  readers.forEach(reader => f.box({ x: 440, y: reader.y, w: 180, h: reader.sub.length === 2 ? 52 : 44, hue: reader.hue, title: reader.title, titleSize: 11, sub: reader.sub }));
  f.path('M420 98 H430 V50 H439', { style: 'call' });
  f.path('M420 98 H430 V114 H439', { style: 'call' });
  f.path('M420 98 H430 V170 H439', { style: 'call' });
  f.path('M420 98 H430 V234 H439', { style: 'call' });
  f.text(20, 170, 'The server wrote 178,853 bytes. The kit masked the path and', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 185, 'added a newline, so its copy has 178,398 bytes. Without', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 200, 'the newline it has the digest of canonical-O1.json.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(440, 284, '2 of 8 already in the ledger', { size: 11, serif: true, hue: 'ink-soft' });
});
