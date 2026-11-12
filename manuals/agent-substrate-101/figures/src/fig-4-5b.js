'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/footprint-x86.json'));
const held = data.with_25_suspended_actors;
const after = data.after_delete;
const gib = mib => mib / 1024;
const label = mib => (mib < 100 ? `${mib} MiB` : `${gib(mib).toFixed(1)} GiB`);

const X = 64;
const W = 552;
const SLOT = W / 6;

module.exports = figure('fig-4-5b', {
  height: 326,
  title: 'Disk that 25 suspended actors hold, and what is left after their deletion',
  desc: `Six bars in GiB, three for each of two samples. With ${held.actors} suspended actors, the node holds ${held.node_snapshots_mib} MiB of snapshots and a cache of ${held.node_snapshot_cache_mib} MiB, and the object store holds ${held.object_store_mib} MiB. After the actors are deleted, the node holds ${after.node_snapshots_mib} MiB of snapshots and the same cache of ${after.node_snapshot_cache_mib} MiB, and the object store still holds ${after.object_store_mib} MiB of golden snapshots.`,
}, f => {
  const c = chart(f, { x: X, y: 40, w: W, h: 196, xDomain: [0, 6], yDomain: [0, 12], yTicks: [0, 4, 8, 12], yLabel: 'GiB on disk, x86 server guest, one sample of each' });
  const group = sample => [
    { name: 'snapshots', value: gib(sample.node_snapshots_mib), label: label(sample.node_snapshots_mib), hue: 'violet' },
    { name: 'cache', value: gib(sample.node_snapshot_cache_mib), label: label(sample.node_snapshot_cache_mib), hue: 'violet' },
    { name: 'object store', value: gib(sample.object_store_mib), label: label(sample.object_store_mib), hue: 'teal' },
  ];
  c.bars([...group(held), ...group(after)]);
  f.rule(X + W / 2, 30, X + W / 2, 314, { dash: 'dashed' });
  [0, 3].forEach(first => {
    const left = X + SLOT * first + 14;
    const right = X + SLOT * (first + 2) - 14;
    f.rule(left, 264, right, 264, { hue: 'violet' });
    f.text((left + right) / 2, 279, 'on the node', { size: 11, anchor: 'middle', hue: 'violet' });
  });
  f.text(X + W / 4, 308, `${held.actors} actors suspended`, { size: 12, anchor: 'middle', weight: 700 });
  f.text(X + (W * 3) / 4, 308, 'after the actors are deleted', { size: 12, anchor: 'middle', weight: 700 });
  f.text(X + SLOT * 5.5, c.py(gib(after.object_store_mib)) - 24, 'golden snapshots stay', { size: 11, serif: true, hue: 'teal', anchor: 'middle' });
});
