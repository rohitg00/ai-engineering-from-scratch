'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

const frames = [
  { n: 1, x: 60, hue: 'amber', time: '09:00:01.750Z' },
  { n: 2, x: 310, hue: 'amber', time: '09:00:02.000Z', gap: 185 },
  ...[3, 4, 5, 6, 7, 8].map((n, index) => ({ n, x: Math.round(310 + (index + 1) * 250 / 7), hue: 'green' })),
  { n: 9, x: 560, hue: 'amber', time: '09:00:02.250Z', gap: 435 },
];

const updates = {
  3: ['test-log, name: test-log.txt', 'creates artifacts[0] and parts[0]'],
  4: ['test-log, append: true', 'adds parts[1]'],
  5: ['test-log, append: true', 'adds parts[2]'],
  6: ['test-log, append: true', 'adds parts[3]'],
  7: ['test-log, append: true, lastChunk: true', 'adds parts[4], the last chunk'],
  8: ['summary, name: summary.json, lastChunk: true', 'creates artifacts[1], one data part'],
};

const lines = [
  ['collected 12 items', false],
  ['progress line for tests/test_charges.py, at 66%', true],
  ['progress line for tests/test_refunds.py, at 100%', true],
  ['FAILED tests/test_refunds.py::test_partial_refund - AssertionError: 450 != 500', false],
  ['1 failed, 11 passed in 4.21s', false],
];

module.exports = figure('fig-artifact-chunks', {
  height: 474,
  title: 'Five chunks become one stored artifact',
  desc: 'Top: the nine stream frames of the streamed run on the kit clock. Frames 1, 2 and 9 are status frames stamped 09:00:01.750Z, 09:00:02.000Z and 09:00:02.250Z, 250 ms apart. Frames 3 to 8 are artifact updates that carry no timestamp and fall between the second and third stamps. Middle: a table of the artifactId and flags each of frames 3 to 8 carries and what it does to the stored task: frame 3 creates artifact test-log with its first part, frames 4 to 7 append one part each, frame 7 sets lastChunk, and frame 8 creates the summary artifact. Bottom: the stored test-log.txt artifact with its five text parts, one per chunk.',
}, f => {
  f.kicker(20, 18, 'the nine frames on the kit clock');
  const stops = [36, ...frames.flatMap(frame => [frame.x - 9, frame.x + 9]), 604];
  for (let i = 0; i < stops.length; i += 2) f.rule(stops[i], 70, stops[i + 1], 70, { hue: 'ink-mute' });
  f.text(435, 98, 'frames 3 to 8 carry no timestamp', { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });
  f.box({ x: 20, y: 114, w: 330, h: 26, hue: 'indigo', title: 'in the stream: artifactId and flags', titleSize: 12, align: 'left' });
  f.box({ x: 356, y: 114, w: 264, h: 26, hue: 'teal', title: 'in the stored task', titleSize: 12, align: 'left' });

  for (const frame of frames) {
    f.beat(frame.n);
    if (frame.time) {
      f.rule(frame.x, 44, frame.x, 61, { hue: 'amber' });
      f.text(frame.x, 38, frame.time, { size: 11, hue: 'amber', anchor: 'middle' });
    }
    if (frame.gap) f.text(frame.gap, 54, '250 ms', { size: 11, hue: 'ink-soft', anchor: 'middle' });
    f.step(frame.x, 70, frame.n, { hue: frame.hue });
    const update = updates[frame.n];
    if (update) {
      const y = 140 + (frame.n - 3) * 26;
      f.rect(20, y, 330, 26, { fill: color('paper'), stroke: color('panel-edge') });
      f.rect(356, y, 264, 26, { fill: color('paper'), stroke: color('panel-edge') });
      f.step(36, y + 13, frame.n, { hue: 'green' });
      f.text(54, y + 17, update[0], { size: 11 });
      f.text(366, y + 17, update[1], { size: 11 });
    }
    if (frame.n === 3) f.box({ x: 20, y: 322, w: 600, h: 28, hue: 'green', title: 'artifacts[0] · artifactId test-log · name test-log.txt', titleSize: 12, align: 'left' });
    const part = frame.n - 3;
    if (part >= 0 && part < lines.length) {
      const [line, described] = lines[part];
      const y = 350 + part * 24;
      f.rect(20, y, 600, 24, { fill: color('paper'), stroke: color('panel-edge') });
      f.text(30, y + 16, `parts[${part}]`, { size: 11, hue: 'ink-soft' });
      f.text(94, y + 16, line, described ? { size: 11, serif: true, italic: true, hue: 'ink-soft' } : { size: 11 });
    }
  }
});
