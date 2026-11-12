'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

const SLOT = 30;
const GAP = 6;

function slots(f, x, y, count, perRow, style, size = SLOT) {
  for (let i = 0; i < count; i += 1) {
    const cx = x + (i % perRow) * (size + GAP);
    const cy = y + Math.floor(i / perRow) * (size + GAP);
    f.rect(cx, cy, size, size, style);
  }
}

module.exports = figure('fig-4-5', {
  height: 330,
  title: 'Running actors per worker follow the CPU that the worker reports',
  desc: 'Two columns. On the left, each of two workers with a limit of 2 CPUs reports 2000 millicores and holds two actors that declare 1 CPU each. A fifth actor has no room and its request returns 503 after 5.06 seconds. On the right, one kagent worker with no limits on a node with 16 vCPUs reports 16000 millicores. With 24 turns at the same time, 16 actors run and 8 wait.',
}, f => {
  f.kicker(20, 18, 'Limits set: cpu 2, memory 3Gi');
  f.kicker(336, 18, 'No limits, node with 16 vCPUs');
  f.rule(320, 8, 320, 322, { dash: 'dashed' });

  const running = { fill: color('green-fill'), stroke: color('green-ink') };
  const waiting = { fill: 'none', stroke: color('amber-ink'), dash: 'dashed' };
  const refused = { fill: color('rose-fill'), stroke: color('rose-ink'), dash: 'dashed' };

  f.rect(20, 34, 130, 92, { hue: 'violet' });
  f.text(85, 52, 'worker bzgjd', { size: 11.5, anchor: 'middle', weight: 700 });
  slots(f, 49, 62, 2, 2, running);
  f.text(85, 114, 'CPU 2000/2000', { size: 11, anchor: 'middle', hue: 'ink-soft' });
  f.rect(162, 34, 130, 92, { hue: 'violet' });
  f.text(227, 52, 'worker f65dl', { size: 11.5, anchor: 'middle', weight: 700 });
  slots(f, 191, 62, 2, 2, running);
  f.text(227, 114, 'CPU 2000/2000', { size: 11, anchor: 'middle', hue: 'ink-soft' });

  slots(f, 49, 150, 1, 1, refused);
  f.text(90, 162, 'fifth actor b0-5', { size: 11.5, weight: 700, hue: 'rose' });
  f.text(90, 178, '503 after 5.06 s', { size: 11, hue: 'rose' });
  f.text(20, 218, 'capacity: 2 workers x 2 CPUs = 4 actors', { size: 11.5 });
  f.text(20, 236, 'each actor declares 1000 millicores', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 252, 'memory was not the limit: 512Mi of 3008Mi', { size: 11, serif: true, hue: 'ink-soft' });

  f.rect(336, 34, 284, 196, { hue: 'violet' });
  f.text(478, 52, 'worker kagent-default', { size: 11.5, anchor: 'middle', weight: 700 });
  slots(f, 345, 62, 16, 8, running, 28);
  f.text(478, 146, 'CPU 16000/16000, 16 turns run', { size: 11, anchor: 'middle', hue: 'ink-soft' });
  slots(f, 345, 162, 8, 8, waiting, 28);
  f.text(478, 210, '8 more turns wait for a free CPU', { size: 11, anchor: 'middle', hue: 'amber' });
  f.text(336, 252, '24 turns at once, all completed', { size: 11.5 });
  f.text(336, 270, 'in 4.3 to 7.8 s on the kagent guest', { size: 11, serif: true, hue: 'ink-soft' });

  const legend = [[running, 'running actor, 1 CPU', 20], [waiting, 'waits', 180], [refused, 'refused', 244]];
  for (const [style, label, x] of legend) {
    f.rect(x, 298, 14, 12, style);
    f.text(x + 20, 308, label, { size: 11, serif: true, hue: 'ink-soft' });
  }
});
