'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

const xOf = seconds => Math.round(60 + (seconds * 560) / 340);
const marks = [
  { n: 1, seconds: 6.3, text: '6.3 s: list_procedures on this Mac, ledger-arm64-O1, 33,872 bytes' },
  { n: 2, seconds: 64, text: 'about 64 s: binary_overview on Linux x64 under WSL2, from the docs' },
  { n: 3, seconds: 163, text: 'about 163 s: binary_overview on Windows x64, from the docs, the 60 s default timed out' },
];

module.exports = figure('fig-8-2', {
  height: 352,
  title: 'Two deadlines and three measured first calls',
  desc: 'One axis in seconds from 0 to 340. A grey bar from 0 to 60 s is the client default of 60,000 ms in SDK 2.3.1. A dashed grey bar from 0 to 240 s is the client setting the docs used as an example. A blue bar from 0 to 330 s is the rea startup deadline of 330,000 ms. Three numbered marks are measured first calls: 6.3 s for list_procedures on this Mac on the 33,872-byte ledger-arm64-O1, about 64 s for a binary_overview on Linux x64 under WSL2 from the docs, and about 163 s for a binary_overview on Windows x64 from the docs, where the 60 s default timed out.',
}, f => {
  f.text(60, 44, 'client default 60,000 ms (SDK 2.3.1)', { size: 11, hue: 'grey' });
  f.rect(xOf(0), 50, xOf(60) - xOf(0), 16, { fill: color('grey-fill'), stroke: color('grey-ink') });
  f.text(60, 94, 'client setting the docs used as an example, 240,000 ms', { size: 11, hue: 'grey' });
  f.rect(xOf(0), 100, xOf(240) - xOf(0), 16, { fill: 'none', stroke: color('grey-ink'), dash: 'dashed' });
  f.text(60, 144, 'rea startup deadline 330,000 ms, REA_GHIDRA_STARTUP_TIMEOUT_MS', { size: 11, hue: 'blue' });
  f.rect(xOf(0), 150, xOf(330) - xOf(0), 16, { fill: color('blue-fill'), stroke: color('blue-ink') });
  f.text(60, 194, 'measured first Ghidra-backed calls', { size: 11, hue: 'violet' });
  for (const mark of marks) {
    f.rule(xOf(mark.seconds), 219, xOf(mark.seconds), 236, { hue: 'violet', dash: 'dashed', width: 1.2 });
    f.step(xOf(mark.seconds), 210, mark.n, { hue: 'violet' });
  }
  f.rule(60, 236, 620, 236, { hue: 'ink' });
  for (const seconds of [0, 60, 120, 180, 240, 300]) {
    const x = xOf(seconds);
    f.rule(x, 232, x, 240, { hue: 'ink' });
    f.text(x, 254, `${seconds} s`, { size: 11, anchor: 'middle', hue: 'ink-soft' });
  }
  f.kicker(20, 282, 'measured first calls');
  marks.forEach((mark, index) => {
    const y = 302 + index * 18;
    f.step(30, y - 4, mark.n, { hue: 'violet' });
    f.text(48, y, mark.text, { size: 11, serif: true });
  });
});
