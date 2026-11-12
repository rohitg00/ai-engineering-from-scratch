'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/timers-x86.json'));
const X0 = 96;
const X1 = 612;
const MINUTES = 43;
const px = minutes => X0 + (minutes / MINUTES) * (X1 - X0);
const clock = seconds => `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`;
const upload = Math.min(...data.actors.map(a => a.seconds_to_upload));
const detach = Math.max(...data.actors.map(a => a.seconds_to_detach));

module.exports = figure('fig-3-4', {
  height: 312,
  title: 'Where a snapshot lives after an asynchronous suspend',
  desc: 'A timeline of four actors, d0, d50, d200 and d500, over 43 minutes after an asynchronous suspend with default atelet timers on the x86 server guest. For the first 5 minutes each snapshot is only on the node and its state is PENDING. From about 5 minutes to about 30 minutes the snapshot is on the node and in the object store. After about 30 minutes the node copy is removed and only the object store copy remains. The first three uploads completed after 5 min 1 s to 5 min 2 s, and the 500 MiB one after 5 min 11 s.',
}, f => {
  f.rect(20, 14, 14, 10, { hue: 'rose', dash: 'dashed' });
  f.text(40, 23, 'node only, PENDING', { size: 11, hue: 'rose' });
  f.rect(196, 14, 14, 10, { hue: 'violet' });
  f.text(216, 23, 'node and object store', { size: 11, hue: 'violet' });
  f.rect(390, 14, 14, 10, { hue: 'teal' });
  f.text(410, 23, 'object store only', { size: 11, hue: 'teal' });

  data.actors.forEach((actor, index) => {
    const y = 66 + index * 38;
    const up = actor.seconds_to_upload / 60;
    const down = actor.seconds_to_detach / 60;
    f.text(20, y + 14, actor.actor, { size: 12, weight: 700 });
    f.text(56, y + 14, `${actor.mib}`, { size: 11, serif: true, hue: 'ink-soft' });
    f.rect(px(0), y, px(up) - px(0), 20, { hue: 'rose', dash: 'dashed' });
    f.rect(px(up), y, px(down) - px(up), 20, { hue: 'violet' });
    f.rect(px(down), y, px(42) - px(down), 20, { hue: 'teal' });
    f.dot(px(42), y + 10, { hue: 'amber', r: 3.5 });
  });
  f.text(56, 56, 'MiB', { size: 11, serif: true, hue: 'ink-soft' });

  f.rule(px(upload / 60), 30, px(upload / 60), 226, { hue: 'teal', dash: 'dashed', width: 1.2 });
  f.text(px(upload / 60) + 6, 40, `upload done after ${clock(upload)}`, { size: 11, hue: 'teal' });
  f.rule(px(detach / 60), 46, px(detach / 60), 226, { hue: 'violet', dash: 'dashed', width: 1.2 });
  f.text(px(detach / 60) - 6, 56, `node copy removed after ${clock(detach)}`, { size: 11, hue: 'violet', anchor: 'end' });

  f.rule(X0, 232, X1, 232, { hue: 'ink' });
  for (let m = 0; m <= 40; m += 5) {
    f.rule(px(m), 228, px(m), 236, { hue: 'ink' });
    f.text(px(m), 250, String(m), { size: 11, anchor: 'middle', hue: 'ink-soft' });
  }
  f.kicker(20, 250, 'Minutes');
  f.dot(26, 272, { hue: 'amber', r: 3.5 });
  f.text(36, 276, 'one request 42 minutes after the suspend: every actor resumed from the object store', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 296, 'In the rose part, losing the node copy leaves the actor CRASHED. Each time is at most 10 s late.', { size: 11, serif: true, hue: 'ink-soft' });
});
