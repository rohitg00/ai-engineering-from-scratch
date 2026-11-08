'use strict';

const { figure } = require('../../../_shared/figkit.js');

const rows = [
  ['GPU idle, log grows', 'count 503 lines', 'read the first error'],
  ['FlashAttention 3 error', 'compute capability', 'not Hopper: no FA3'],
  ['Ray OutOfMemoryError', 'memory at the kill', 'use a smaller model'],
  ['step times differ', 'heat pauses', 'compare clean steps'],
  ['attention name rejected', 'the ValueError list', 'pick a listed name'],
];

module.exports = figure('fig-7-1', {
  height: 360,
  title: 'Start from what you see',
  desc: 'Five symptoms from our runs, each with the first check and the fix. An idle GPU with a growing log means a dead engine. A FlashAttention 3 error means a GPU that is not Hopper, because the FA3 build in the image is for Hopper only. A Ray out-of-memory error means the node was full. Step times that differ mean heat pauses. A rejected trainer attention name means a name that the installed transformers library does not accept.',
}, f => {
  f.kicker(20, 28, 'symptom', { hue: 'rose' });
  f.kicker(240, 28, 'first check', { hue: 'amber' });
  f.kicker(440, 28, 'fix', { hue: 'green' });
  rows.forEach(([symptom, check, fix], i) => {
    const y = 42 + i * 58;
    const a = f.box({ x: 20, y, w: 190, h: 44, hue: 'rose', title: symptom, titleSize: 11.5 });
    const b = f.box({ x: 240, y, w: 166, h: 44, hue: 'amber', title: check, titleSize: 11.5, weight: 400 });
    const c = f.box({ x: 440, y, w: 180, h: 44, hue: 'green', title: fix, titleSize: 11.5, weight: 400 });
    f.arrow([a.x + a.w, y + 22], [b.x - 1, y + 22], { style: 'call' });
    f.arrow([b.x + b.w, y + 22], [c.x - 1, y + 22], { style: 'call' });
  });
  f.text(20, 342, 'Section 7.1 has every symptom we hit, and six more from issue reports.', { size: 12, serif: true });
});
