'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

const source = [
  'you wrote · ledger.c',
  'int percent_change(',
  '  int before, int after) {',
  '  if (before == 0)',
  '    return 0;',
  '  return (after - before)',
  '    * 100 / before;',
  '}',
];
const listing = [
  'clang -O1 made · 24 bytes',
  '500  cbz w0, 0x100000514',
  '504  sub w8, w1, w0',
  '508  mov w9, #0x64',
  '50c  mul w8, w8, w9',
  '510  sdiv w0, w8, w0',
  '514  ret',
];
const pseudocode = [
  'Ghidra decompiled',
  'ulong _percent_change(',
  '  ulong param_1,int param_2)',
  'iVar2 = (int)param_1;',
  'if (iVar2 != 0) {',
  '  uVar1 = 0;',
  '  if (iVar2 != 0) {',
  '  uVar1 = ((param_2 - iVar2)',
  '    * 100) / iVar2;',
  '  param_1 = (ulong)uVar1;',
  'return param_1;',
];

const OY = 285;
const COLUMN_TOP = 362;
const SEGMENT_SCALE = 40 / 16384;

const column = (f, x, w, hue, lines) => {
  const h = lines.length * 15 + 14;
  f.rect(x, COLUMN_TOP, w, h, { fill: color('paper'), stroke: color(`${hue}-ink`) });
  lines.forEach((line, index) => f.text(x + 6, COLUMN_TOP + 18 + index * 15, line.replace(/^ +/, lead => '\u00a0'.repeat(lead.length)), { size: 11, hue: index === 0 ? 'ink-soft' : undefined }));
  return COLUMN_TOP + h;
};

module.exports = figure('plate-rea-investigation', {
  height: 668,
  title: 'One function, four views',
  desc: 'The recorded run of rea function on ledger-arm64-O1 for _percent_change with the Ghidra provider, drawn as machines on one bench. You call rea 6.7.0, which hands the question to the BinarySession bound to ghidra, which calls the GhidraClient over bridge.sock, which launches Ghidra 12.1.4 as a headless JVM that imports and analyzes the artifact ledger-arm64-O1, a mach-o arm64 executable of 33872 bytes drawn as a stack of its file segments: __TEXT 16384 bytes, __DATA_CONST 16384 bytes, and __LINKEDIT 1104 bytes. The 24 bytes of _percent_change sit at 0x100000500 near the top of __TEXT. Three columns show the same function: the C you wrote in ledger.c, the pseudocode Ghidra decompiled with a second zero check the source never had, and the six instructions clang -O1 made from cbz w0 at 0x100000500 to ret at 0x100000514. The Evidence record ev_b492c85e at the bottom names the operation analyze_function, the provider ghidra 12.1.4, confidence observed, ten limitations, and the subject.',
}, f => {
  const bench = f.isoView({ ox: 0, oy: OY, angle: 'true' });
  const unit = (cx, size, h, hue, options = {}) => {
    const [xc, yc] = bench.at(cx, 0);
    return f.isoBlock(bench, { x: xc - size / 2, y: yc - size / 2, w: size, d: size, h, hue, ...options });
  };
  const face = (machine, points, hue, opacity) => f.polygon(points.map(([u, v, k]) => machine.P(u, v, k)), { fill: color(hue), fillOpacity: opacity });

  f.kicker(20, 18, 'four views');
  f.text(620, 18, 'rea function ledger-arm64-O1 _percent_change --provider ghidra', { size: 11, anchor: 'end', hue: 'ink-soft' });

  const stations = [
    { cx: 48, row: 0, w: 74, hue: 'grey', title: 'you', sub: 'ledger.c' },
    { cx: 140, row: 1, w: 84, hue: 'blue', title: 'rea 6.7.0', sub: 'the CLI' },
    { cx: 236, row: 0, w: 112, hue: 'blue', title: 'BinarySession', sub: 'ghidra bound' },
    { cx: 330, px: 250, row: 1, w: 104, hue: 'violet', title: 'GhidraClient', sub: 'bridge.sock' },
    { cx: 430, px: 362, row: 1, w: 104, hue: 'violet', title: 'Ghidra 12.1.4', sub: 'headless JVM' },
    { cx: 534, px: 470, row: 0, w: 150, hue: 'green', title: 'ledger-arm64-O1', sub: ['mach-o arm64', '33872 bytes', 'sha256 01b5d08b'] },
  ];
  const pills = stations.map(station => {
    const x = station.px !== undefined ? station.px : Math.min(620 - station.w, Math.max(20, station.cx - station.w / 2));
    return f.box({ x, y: station.row ? 82 : 30, w: station.w, hue: station.hue, title: station.title, sub: station.sub, titleSize: 11.5, pad: 6 });
  });

  f.isoBeam(bench, { sx0: 14, sx1: 626, c: 60, back: 120, h: 6, hue: 'paper', inkHue: 'ink-mute', ink: 1, shadow: false });

  const you = unit(48, 34, 22, 'grey');
  face(you, [[6, 34, 6], [28, 34, 6], [28, 34, 19], [6, 34, 19]], 'ink', 0.75);
  face(you, [[9, 34, 15], [20, 34, 15], [20, 34, 13.6], [9, 34, 13.6]], 'green-fill', 0.9);
  face(you, [[9, 34, 11], [24, 34, 11], [24, 34, 9.6], [9, 34, 9.6]], 'green-fill', 0.9);

  const rea = unit(140, 38, 26, 'blue');
  face(rea, [[8, 13, 26], [30, 13, 26], [30, 17, 26], [8, 17, 26]], 'blue-ink', 0.6);
  face(rea, [[8, 23, 26], [22, 23, 26], [22, 27, 26], [8, 27, 26]], 'blue-ink', 0.6);

  const session = unit(236, 40, 28, 'blue');
  for (const v of [8, 17, 26]) face(session, [[7, 40, v], [33, 40, v], [33, 40, v + 3], [7, 40, v + 3]], 'blue-ink', 0.45);

  const client = unit(330, 38, 24, 'violet');
  const sock = f.isoDrum(bench, { x: client.box.x + 19, y: client.box.y + 19, z: 24, r: 8, h: 7, hue: 'violet' });

  const jvm = unit(430, 42, 54, 'violet');
  face(jvm, [[8, 42, 34], [34, 42, 34], [34, 42, 46], [8, 42, 46]], 'ink', 0.75);
  for (const k of [14, 22]) face(jvm, [[8, 42, k], [34, 42, k], [34, 42, k + 3], [8, 42, k + 3]], 'violet-ink', 0.45);

  const [ax, ay] = bench.at(534, 0);
  const size = 46;
  const base = { x: ax - size / 2, y: ay - size / 2, w: size, d: size };
  const segments = [
    { name: '__LINKEDIT', bytes: 1104, hue: 'green' },
    { name: '__DATA_CONST', bytes: 16384, hue: 'green' },
    { name: '__TEXT', bytes: 16384, hue: 'green' },
  ];
  const heights = segments.map(segment => Math.max(3, segment.bytes * SEGMENT_SCALE));
  const total = heights.reduce((a, b) => a + b, 0);
  f.isoShadow(bench, { ...base, h: total });
  let z = 0;
  let text;
  segments.forEach((segment, index) => {
    const layer = f.isoBlock(bench, { ...base, z, h: heights[index], hue: segment.hue, shadow: false });
    if (segment.name === '__TEXT') text = layer;
    z += heights[index];
  });
  const fnTop = 40 - 1280 * SEGMENT_SCALE;
  face(text, [[0, size, fnTop], [size, size, fnTop], [size, size, fnTop - 2], [0, size, fnTop - 2]], 'rose-ink', 0.95);
  face(text, [[size, 0, fnTop], [size, size, fnTop], [size, size, fnTop - 2], [size, 0, fnTop - 2]], 'rose-ink', 0.95);

  const tower = jvm.box;
  const postBase = bench.P(tower.x + 21, tower.y + 21, 54);
  const lensAt = [base.x + 20, base.y + 20];
  const postTop = bench.P(tower.x + 21, tower.y + 21, total + 26);
  const arm = bench.P(lensAt[0], lensAt[1], total + 26);
  f.rule(postBase[0], postBase[1], postTop[0], postTop[1], { hue: 'violet', width: 2.5 });
  f.rule(postTop[0], postTop[1], arm[0], arm[1], { hue: 'violet', width: 2.5 });
  const lens = f.isoDrum(bench, { x: lensAt[0], y: lensAt[1], z: total + 18, r: 10, h: 3, hue: 'blue' });

  const targets = [you.top, rea.top, session.top, sock.top, postTop, text.P(4, size - 4, 40)];
  pills.forEach((pill, index) => {
    const lx = index === 5 ? targets[index][0] : stations[index].cx;
    f.leader([lx, pill.y + pill.h + 2], [lx, targets[index][1] - 1], { hue: stations[index].hue });
  });

  const machines = [you, rea, session, client, jvm];
  const labels = ['function', 'execute', 'call', 'launch', 'import'];
  const styles = ['call', 'call', 'call', 'effect', 'call'];
  for (let i = 0; i < 5; i += 1) {
    f.beat(i + 1);
    const from = machines[i].P(machines[i].box.w, 0, 12);
    const to = i < 4 ? machines[i + 1].P(0, machines[i + 1].box.d, 12) : bench.P(base.x, base.y + size, 12);
    f.path(`M${from[0] + 2} ${from[1]} L${to[0] - 2} ${to[1]}`, { style: styles[i] });
    f.text((stations[i].cx + stations[i + 1].cx) / 2, OY + 54, labels[i], { size: 11, anchor: 'middle', hue: 'ink-soft' });
  }

  f.beat(6);
  f.text(620, 130, '_percent_change', { size: 11, anchor: 'end', hue: 'rose', weight: 700 });
  f.text(620, 144, '24 bytes', { size: 11, anchor: 'end', hue: 'rose' });
  f.text(620, 158, 'at 0x100000500', { size: 11, anchor: 'end', hue: 'rose' });
  const sliver = text.P(size, size * 0.6, fnTop - 1);
  f.leader([sliver[0], 163], sliver, { hue: 'rose' });

  f.arrow([48, OY + 40], [48, COLUMN_TOP - 1], { style: 'call' });
  f.arrow([420, OY + 40], [420, COLUMN_TOP - 1], { style: 'reply' });
  f.arrow([534, OY + 40], [534, COLUMN_TOP - 1], { style: 'reply' });
  column(f, 20, 190, 'green', source);
  const bottom = column(f, 220, 205, 'violet', pseudocode);
  column(f, 435, 185, 'green', listing);

  f.beat(7);
  f.arrow([322, bottom], [322, bottom + 23], { style: 'write', label: 'recorded' });
  f.box({
    x: 20, y: bottom + 24, w: 600, h: 92, hue: 'teal', titleSize: 12,
    title: 'Evidence ev_b492c85e for _percent_change',
    sub: [
      'operation analyze_function · provider ghidra 12.1.4',
      'confidence observed · 10 limitations',
      'subject ledger-arm64-O1 · mach-o arm64',
    ],
  });
});
