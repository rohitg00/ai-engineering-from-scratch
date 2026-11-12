'use strict';

const { figure } = require('../../../_shared/figkit.js');

const columns = [
  { name: 'SNAPSHOT_FIDELITY_VOLUMES', x: 150, keeps: [true, false, false], resume: 'new processes', seen: ['kagent: /data kept,', '/tmp and sleep gone'] },
  { name: 'SNAPSHOT_FIDELITY_ROOTFS', x: 310, keeps: [true, true, false], resume: 'new processes', seen: ['not run by us'] },
  { name: 'SNAPSHOT_FIDELITY_MEMORY', x: 470, keeps: [true, true, true], resume: 'same processes', seen: ['counter: memory count', 'went on from 8 to 9'] },
];
const layers = [
  ['durable volumes', 'durableDir mounts'],
  ['root filesystem', 'writes since boot'],
  ['process memory', 'processes and RAM'],
];

module.exports = figure('fig-3-4b', {
  height: 306,
  title: 'What each snapshot fidelity keeps',
  desc: 'Three columns for the three snapshot fidelity levels. SNAPSHOT_FIDELITY_VOLUMES keeps only durable volumes and resumes with new processes. SNAPSHOT_FIDELITY_ROOTFS keeps durable volumes and root filesystem writes and also resumes with new processes. SNAPSHOT_FIDELITY_MEMORY keeps volumes, root filesystem writes and process memory, so the same processes continue. A row under the columns says what we saw for each level in our runs.',
}, f => {
  f.kicker(20, 18, 'Layer');
  columns.forEach(column => {
    f.text(column.x + 75, 18, column.name.replace('SNAPSHOT_FIDELITY_', ''), { size: 12, weight: 700, anchor: 'middle' });
  });
  layers.forEach(([title, sub], row) => {
    const y = 30 + row * 58;
    f.text(20, y + 22, title, { size: 12, weight: 700 });
    f.text(20, y + 38, sub, { size: 11, serif: true, hue: 'ink-soft' });
    columns.forEach(column => {
      const kept = column.keeps[row];
      f.box({ x: column.x, y, w: 150, h: 48, hue: kept ? 'teal' : 'grey', dash: kept ? undefined : 'dashed', title: kept ? 'kept' : 'gone', weight: kept ? 700 : 400 });
    });
  });
  f.kicker(20, 222, 'On resume');
  f.kicker(20, 262, 'We saw');
  columns.forEach(column => {
    f.text(column.x + 75, 222, column.resume, { size: 11, serif: true, anchor: 'middle', hue: 'ink' });
    column.seen.forEach((line, index) => f.text(column.x + 75, 262 + index * 16, line, { size: 11, serif: true, anchor: 'middle', hue: 'ink-soft' }));
  });
  f.rule(20, 238, 620, 238, { hue: 'ink-mute', opacity: 0.4 });
  f.text(20, 298, 'The enum names carry the prefix SNAPSHOT_FIDELITY_. Each level includes the levels to its left.', { size: 11, serif: true, hue: 'ink-soft' });
});
