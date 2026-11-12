'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/validation-fidelity-x86.json'));
const level = name => data.levels.find(l => l.fidelity === `SNAPSHOT_FIDELITY_${name}`);
const two = value => (Math.round(value * 100) / 100).toFixed(2);
const size = snapshot => (snapshot.kib < 1024 ? `${snapshot.kib} KiB` : `${snapshot.mib.toFixed(1)} MiB`);
const column = (name, x, keeps, resume) => {
  const l = level(name);
  const c = l.after_last_resume;
  return { name, x, keeps, resume, median: `${two(l.resume_node.seconds.median)} s median of ${l.resume_node.seconds.n}`, snapshot: `snapshot ${size(l.node_snapshot)}`, seen: [`memory ${c.memory_count}, rootfs ${c.rootfs_count},`, `volume ${c.volume_count}`], level: l };
};
const columns = [
  column('VOLUMES', 150, [true, false, false], 'new processes'),
  column('ROOTFS', 310, [true, true, false], 'new processes'),
  column('MEMORY', 470, [true, true, true], 'same processes'),
];
const calls = columns[0].level.requests;
const said = columns.map(c => `${c.name}: counts ${c.seen.join(' ')}, ${c.median}, ${c.snapshot}`).join('. ');
const layers = [
  ['durable volumes', 'durableDir mounts'],
  ['root filesystem', 'writes since boot'],
  ['process memory', 'processes and RAM'],
];

module.exports = figure('fig-3-4b', {
  height: 370,
  title: 'What each snapshot fidelity keeps',
  desc: `Three columns for the three snapshot fidelity levels. SNAPSHOT_FIDELITY_VOLUMES keeps only durable volumes and resumes with new processes. SNAPSHOT_FIDELITY_ROOTFS keeps durable volumes and root filesystem writes and also resumes with new processes. SNAPSHOT_FIDELITY_MEMORY keeps volumes, root filesystem writes and process memory, so the same processes continue. Rows under the columns give what one actor for each level showed on the x86 server guest after ${calls} calls with suspends between them: its three counts, its median resume from the node, and its snapshot size. ${said}.`,
}, f => {
  f.kicker(20, 18, 'Layer');
  columns.forEach(column => {
    f.text(column.x + 75, 18, column.name, { size: 12, weight: 700, anchor: 'middle' });
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
  f.kicker(20, 280, 'Counts');
  f.text(20, 296, `after ${calls} calls`, { size: 11, serif: true, hue: 'ink-soft' });
  columns.forEach(c => {
    f.text(c.x + 75, 222, c.resume, { size: 11.5, weight: 700, anchor: 'middle', hue: 'ink' });
    f.text(c.x + 75, 238, c.median, { size: 11, serif: true, anchor: 'middle', hue: 'violet' });
    f.text(c.x + 75, 254, c.snapshot, { size: 11, serif: true, anchor: 'middle', hue: 'teal' });
    c.seen.forEach((line, index) => f.text(c.x + 75, 280 + index * 16, line, { size: 11, serif: true, anchor: 'middle', hue: 'ink-soft' }));
  });
  f.rule(20, 264, 620, 264, { hue: 'ink-mute', opacity: 0.4 });
  f.text(20, 326, 'The enum names carry the prefix SNAPSHOT_FIDELITY_.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 342, 'Each level includes the levels to its left.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 358, 'A count of 1 means that the count started again at the last resume.', { size: 11, serif: true, hue: 'ink-soft' });
});
