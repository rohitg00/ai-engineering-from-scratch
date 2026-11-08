'use strict';

const { figure, color } = require('../figkit.js');

module.exports = figure('tpl-timeline', {
  height: 236,
  title: 'Two tracks on one commit axis',
  desc: 'Two tracks run left to right over a numbered commit axis. Each track shows a task running as a solid bar, waiting as a hatched bar, and resumed work as a dashed bar after a stop line drawn in rose across both tracks.',
}, f => {
  f.kicker(20, 64, 'Track 1');
  f.kicker(20, 134, 'Track 2');
  f.text(100, 44, 'submitted', { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });
  f.rect(100, 54, 140, 12, { fill: color('amber-ink'), stroke: 'none' });
  f.hatchRect(240, 54, 80, 12);
  f.rect(320, 54, 60, 12, { fill: color('amber-ink'), stroke: 'none' });
  f.rect(420, 54, 120, 12, { fill: 'none', stroke: color('amber-ink'), dash: 'dashed' });
  f.text(480, 44, 'resumed', { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });
  f.rect(140, 124, 120, 12, { fill: color('amber-ink'), stroke: 'none' });
  f.rect(260, 124, 120, 12, { fill: color('amber-ink'), stroke: 'none' });
  f.rect(420, 124, 80, 12, { fill: 'none', stroke: color('amber-ink'), dash: 'dashed' });
  f.text(200, 114, 'waits on nothing', { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });
  f.rule(400, 26, 400, 186, { hue: 'rose', dash: 'dashed', width: 1.4 });
  f.text(400, 18, 'process stops', { size: 11, hue: 'rose', anchor: 'middle', weight: 700 });
  f.rule(60, 196, 620, 196, { hue: 'ink' });
  for (let k = 0; k <= 14; k += 1) {
    const x = 60 + k * 40;
    f.rule(x, 192, x, 200, { hue: 'ink' });
    f.text(x, 214, String(k * 4 + 1), { size: 11, anchor: 'middle', hue: 'ink-soft' });
  }
  f.kicker(20, 232, 'Commit seq');
});
