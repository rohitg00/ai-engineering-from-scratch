'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

const bands = [
  { x: 130, w: 40, label: 'input' },
  { x: 180, w: 120, label: 'model, step 1' },
  { x: 310, w: 100, label: 'tools, step 2' },
  { x: 420, w: 140, label: 'model, step 3' },
];
const rows = [
  ['updates', [0, 1, 1, 1]],
  ['values', [1, 1, 1, 1]],
  ['messages', [0, 1, 1, 7]],
  ['tasks', [0, 2, 2, 2]],
  ['debug', [0, 2, 2, 2]],
  ['custom', [0, 0, 0, 0]],
  ['tools', [0, 0, 4, 0]],
  ['v3 events', [1, 5, 3, 12]],
];

module.exports = figure('fig-4-1', {
  height: 360,
  title: 'The chunks of one agent run in each stream mode',
  desc: 'Eight rows, one for each stream of the same agent run, over four columns: the input, the model node at step 1, the tools node at step 2, and the model node at step 3. Each mark is one chunk. updates has 3, values 4, messages 9, tasks 6, debug 6, custom 0, the tools mode 4 on the slow_sum agent, and stream_events v3 has 21 events.',
}, f => {
  bands.forEach(band => {
    f.text(band.x + band.w / 2, 24, band.label, { size: 11, anchor: 'middle', hue: band.label === 'input' ? 'violet' : band.label.startsWith('tools') ? 'green' : 'indigo' });
    f.rule(band.x - 5, 34, band.x - 5, 296, { hue: 'ink-mute', dash: 'dashed' });
  });
  f.rule(565, 34, 565, 296, { hue: 'ink-mute', dash: 'dashed' });
  f.kicker(20, 24, 'stream');
  f.kicker(600, 24, 'n', { anchor: 'middle' });
  rows.forEach(([name, counts], i) => {
    const y = 52 + i * 32;
    f.text(20, y + 4, name, { size: 11.5, hue: 'indigo' });
    counts.forEach((n, b) => {
      const band = bands[b];
      const step = n > 0 ? Math.min(14, (band.w - 8) / n) : 0;
      const start = band.x + band.w / 2 - (step * (n - 1)) / 2 - 3;
      for (let k = 0; k < n; k += 1) f.rect(start + k * step, y - 7, 6, 14, { fill: color('indigo-ink'), stroke: 'none' });
    });
    const total = counts.reduce((a, b) => a + b, 0);
    f.text(600, y + 4, String(total), { size: 12, anchor: 'middle', weight: 700, hue: total ? 'indigo' : 'ink-mute' });
  });
  f.text(20, 322, 'Each mark is one chunk. tasks and debug ran with no checkpointer.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 340, 'The tools row is the slow_sum agent: started, two deltas, finished.', { size: 11, serif: true, hue: 'ink-soft' });
});
