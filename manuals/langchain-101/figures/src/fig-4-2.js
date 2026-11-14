'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

const rows = [
  [-1, 'input'], [0, 'loop'], [1, 'loop'], [2, 'loop'], [3, 'loop'],
  [4, 'input'], [5, 'loop'], [6, 'loop'],
  [7, 'input'], [8, 'loop'], [9, 'loop'],
];
const px = step => 70 + (step + 1) * 50;

module.exports = figure('fig-4-2', {
  height: 236,
  title: 'Three turns of one thread in the SQLite file',
  desc: 'Eleven rows of the checkpoints table of SqliteSaver on one step axis from -1 to 9. Turn 1 has an input checkpoint at step -1 and loop checkpoints at steps 0 to 3. Turn 2 has an input checkpoint at step 4 and loop checkpoints at 5 and 6. The connection was closed and the file opened again. Turn 3 has an input checkpoint at step 7 and loop checkpoints at 8 and 9.',
}, f => {
  const turns = [[-1, 3, 'turn 1: What is 2 + 3?'], [4, 6, 'turn 2'], [7, 9, 'turn 3, after the restart']];
  turns.forEach(([a, b, label]) => {
    f.rule(px(a) - 10, 44, px(b) + 10, 44, { hue: 'ink-soft' });
    f.rule(px(a) - 10, 40, px(a) - 10, 48, { hue: 'ink-soft' });
    f.rule(px(b) + 10, 40, px(b) + 10, 48, { hue: 'ink-soft' });
    f.text((px(a) + px(b)) / 2, 32, label, { size: 11, anchor: 'middle', serif: true, hue: 'ink-soft' });
  });
  f.rule((px(6) + px(7)) / 2, 56, (px(6) + px(7)) / 2, 150, { hue: 'grey', dash: 'dashed', width: 1.4 });
  f.text((px(6) + px(7)) / 2, 166, 'file closed, opened again', { size: 11, anchor: 'middle', hue: 'grey' });
  rows.forEach(([step, source]) => {
    const hue = source === 'input' ? 'amber' : 'teal';
    f.rect(px(step) - 9, 78, 18, 34, { fill: color(`${hue}-fill`), stroke: color(`${hue}-ink`) });
    f.text(px(step), 130, source, { size: 11, anchor: 'middle', hue });
  });
  f.rule(50, 186, 630, 186, { hue: 'ink' });
  rows.forEach(([step]) => {
    f.rule(px(step), 182, px(step), 190, { hue: 'ink' });
    f.text(px(step), 204, String(step), { size: 11, anchor: 'middle', hue: 'ink-soft' });
  });
  f.kicker(20, 226, 'step in metadata');
});
