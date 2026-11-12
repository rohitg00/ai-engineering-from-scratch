'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/footprint-x86.json'));
const before = data.with_25_suspended_actors;
const after = data.after_delete;
const sizes = data.local_snapshot_per_actor.map(point => point.x);
const held = sizes.reduce((sum, mib) => sum + mib, 0) * (before.actors / sizes.length);
const mib = value => `${value.toLocaleString('en-US')} MiB`;
const groups = [
  { name: 'bucket ate-snapshots', hue: 'teal', key: 'object_store_mib', note: 'golden snapshots stay' },
  { name: 'node snapshots/', hue: 'violet', key: 'node_snapshots_mib', note: 'removed with the actors' },
  { name: 'node snapshot-cache/', hue: 'violet', key: 'node_snapshot_cache_mib', note: 'atelet trims it later' },
];
const X0 = 186;
const SCALE = 400 / 12000;
const px = value => X0 + value * SCALE;
const TOP = 62;
const PITCH = 62;
const BOTTOM = TOP + groups.length * PITCH;

module.exports = figure('fig-8-1b', {
  height: BOTTOM + 52,
  title: 'Disk use with 25 suspended actors, and after their deletion',
  desc: `Horizontal bars for three places, each with ${before.actors} suspended actors and after the actors were deleted. The bucket held ${mib(before.object_store_mib)} and then ${mib(after.object_store_mib)}. The node snapshot directory held ${mib(before.node_snapshots_mib)} and then ${mib(after.node_snapshots_mib)}. The node snapshot cache held ${mib(before.node_snapshot_cache_mib)} both times. A line marks the ${mib(held)} of memory that the actors held.`,
}, f => {
  f.rect(20, 14, 12, 9, { fill: color('ink-soft'), stroke: 'none' });
  f.text(38, 23, `with ${before.actors} suspended actors`, { size: 11, hue: 'ink-soft' });
  f.rect(250, 14, 12, 9, { fill: color('paper'), stroke: color('ink-soft') });
  f.text(268, 23, 'after the actors were deleted', { size: 11, hue: 'ink-soft' });

  for (const tick of [0, 3000, 6000, 9000, 12000]) {
    f.rule(px(tick), TOP - 8, px(tick), BOTTOM, { hue: 'ink-mute', opacity: tick ? 0.25 : 1 });
    f.text(px(tick), BOTTOM + 16, tick.toLocaleString('en-US'), { size: 11, anchor: 'middle', hue: 'ink-soft' });
  }
  f.rule(X0, BOTTOM, px(12000), BOTTOM, { hue: 'ink' });
  f.text(px(6000), BOTTOM + 34, 'MiB on disk, as du reports it', { size: 11.5, serif: true, anchor: 'middle', hue: 'ink-soft' });

  f.rule(px(held), TOP - 8, px(held), BOTTOM, { hue: 'green', dash: 'dashed' });
  f.text(px(held) - 6, TOP - 12, `memory that the actors held: ${mib(held)}`, { size: 11, serif: true, anchor: 'end', hue: 'green' });

  groups.forEach((group, index) => {
    const y = TOP + index * PITCH;
    f.text(20, y + 18, group.name, { size: 11, weight: 700, hue: group.hue });
    f.text(20, y + 34, group.note, { size: 11, serif: true, hue: 'ink-soft' });
    const full = before[group.key];
    const left = after[group.key];
    f.rect(X0, y + 4, Math.max(px(full) - X0, 1), 16, { fill: color(`${group.hue}-ink`), stroke: 'none' });
    f.text(px(full) + 6, y + 16, mib(full), { size: 11, weight: 700, hue: group.hue, knock: true });
    f.rect(X0, y + 26, Math.max(px(left) - X0, 1), 16, { fill: color(`${group.hue}-fill`), stroke: color(`${group.hue}-ink`) });
    f.text(px(left) + 6, y + 38, mib(left), { size: 11, hue: group.hue, knock: true });
  });
});
