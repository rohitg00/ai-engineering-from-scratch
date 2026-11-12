'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/footprint-x86.json'));
const full = data.with_25_suspended_actors;
const empty = data.after_delete;
const held = data.local_snapshot_per_actor.reduce((sum, row) => sum + row.x, 0) * (full.actors / data.local_snapshot_per_actor.length);
const mib = value => value.toLocaleString('en-US');
const rows = [
  { name: 'snapshots on the node', key: 'node_snapshots_mib', hue: 'violet', note: 'gone with the actors' },
  { name: 'snapshot cache on the node', key: 'node_snapshot_cache_mib', hue: 'violet', note: 'did not shrink' },
  { name: 'object store', key: 'object_store_mib', hue: 'teal', note: 'golden snapshots stay' },
];
const X0 = 204;
const X1 = 572;
const MAX = 12000;
const px = value => X0 + (value / MAX) * (X1 - X0);

module.exports = figure('fig-3-4c', {
  height: 282,
  title: 'Disk use of 25 suspended actors, and what a delete gives back',
  desc: `Horizontal bars with the MiB that du reports in three places on the x86 server guest, with ${full.actors} suspended actors that hold ${mib(held)} MiB of memory together and again after we deleted the actors. Snapshots on the node: ${mib(full.node_snapshots_mib)} MiB, then ${mib(empty.node_snapshots_mib)} MiB. Snapshot cache on the node: ${mib(full.node_snapshot_cache_mib)} MiB, then ${mib(empty.node_snapshot_cache_mib)} MiB. Object store: ${mib(full.object_store_mib)} MiB, then ${mib(empty.object_store_mib)} MiB, which are the golden snapshots of the five templates. A dashed line marks ${mib(held)} MiB.`,
}, f => {
  f.rect(20, 10, 14, 10, { fill: color('ink-soft'), stroke: 'none' });
  f.text(40, 19, `with ${full.actors} suspended actors`, { size: 11, hue: 'ink-soft' });
  f.rect(250, 10, 14, 10, { fill: color('paper'), stroke: color('ink-soft') });
  f.text(270, 19, 'after we deleted the actors', { size: 11, hue: 'ink-soft' });

  f.rule(px(held), 34, px(held), 216, { hue: 'ink', dash: 'dashed' });
  f.text(px(held) - 6, 46, `${mib(held)} MiB: the memory the ${full.actors} actors hold`, { size: 11, serif: true, hue: 'ink-soft', anchor: 'end' });

  rows.forEach((row, index) => {
    const y = 60 + index * 52;
    const before = full[row.key];
    const after = empty[row.key];
    f.text(X0 - 10, y + 12, row.name, { size: 11.5, anchor: 'end', weight: 700 });
    f.text(X0 - 10, y + 28, row.note, { size: 11, serif: true, hue: 'ink-soft', anchor: 'end' });
    f.rect(X0, y, px(before) - X0, 15, { fill: color(`${row.hue}-ink`), stroke: 'none' });
    f.text(px(before) + 6, y + 12, mib(before), { size: 11.5, hue: row.hue, weight: 700, knock: px(before) < px(held) });
    f.rect(X0, y + 18, Math.max(px(after) - X0, 1), 15, { fill: color(`${row.hue}-fill`), stroke: color(`${row.hue}-ink`) });
    f.text(px(after) + 6, y + 30, mib(after), { size: 11.5, hue: row.hue });
  });

  f.rule(X0, 34, X0, 216, { hue: 'ink' });
  f.rule(X0, 216, X1, 216, { hue: 'ink' });
  for (let tick = 0; tick <= MAX; tick += 2000) {
    f.rule(px(tick), 216, px(tick), 220, { hue: 'ink' });
    f.text(px(tick), 233, mib(tick), { size: 11, anchor: 'middle', hue: 'ink-soft' });
  }
  f.text(X1 + 30, 233, 'MiB', { size: 11.5, serif: true, hue: 'ink-soft' });
  f.text(20, 256, 'Five actors for each of 0, 50, 200, 500, and 1,000 MiB of random bytes, each 3 to 8 minutes old.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 272, 'The object store holds one snapshot for each actor and one golden snapshot for each template.', { size: 11, serif: true, hue: 'ink-soft' });
});
