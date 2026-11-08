'use strict';

const { figure } = require('../../../_shared/figkit.js');

const X0 = 70;
const PER_STEP = 0.675;
const Y0 = 200;
const PER_UNIT = 228.6;
const x = step => X0 + step * PER_STEP;
const y = ratio => Y0 - ratio * PER_UNIT;

module.exports = figure('fig-2-3b', {
  height: 252,
  title: 'The new token ratio over 600 decode steps',
  desc: 'A line starts at a ratio of 0.7 at decode step 0 and falls in a straight line to 0.098 at step 600, then stays flat. At step 700 a retraction resets it to 0.714, the value in the log line of issue 8463, and the line starts to fall again.',
}, f => {
  f.rule(X0, Y0, 610, Y0, { hue: 'ink' });
  f.rule(X0, 30, X0, Y0, { hue: 'ink' });
  for (const step of [0, 200, 400, 600, 800]) {
    f.rule(x(step), Y0, x(step), Y0 + 5, { hue: 'ink' });
    f.text(x(step), Y0 + 18, String(step), { size: 11, hue: 'ink-soft', anchor: 'middle' });
  }
  f.kicker(X0, Y0 + 40, 'decode steps');
  f.text(X0 - 6, y(0.7) + 4, '0.7', { size: 11, hue: 'ink-soft', anchor: 'end' });
  f.text(X0 - 6, y(0.098) + 4, '0.098', { size: 11, hue: 'ink-soft', anchor: 'end' });
  f.rule(X0, y(0.098), x(600), y(0.098), { hue: 'ink-mute', dash: 'dotted' });

  const after = 0.714 - (0.7 - 0.098) / 600 * 100;
  f.path(`M${x(0)} ${y(0.7)} L${x(600)} ${y(0.098)} L${x(700)} ${y(0.098)} L${x(700)} ${y(0.714)} L${x(800)} ${y(after)}`, { style: 'state', head: false });
  f.rule(x(700), 30, x(700), Y0, { hue: 'rose', dash: 'dashed' });
  f.text(x(700), 22, 'retraction', { size: 11, hue: 'rose', anchor: 'middle', weight: 700 });
  f.text(x(700) - 12, 110, '0.098 to 0.714', { size: 11, hue: 'ink-soft', anchor: 'end' });
  f.text(x(300), y(0.4) - 8, 'admission grows bolder', { size: 11, serif: true, hue: 'amber' });
});
