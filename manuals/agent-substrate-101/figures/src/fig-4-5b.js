'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/footprint-x86.json'));
const held = data.with_25_suspended_actors;
const after = data.after_delete;
const gib = mib => `${(mib / 1024).toFixed(1)} GiB`;

module.exports = figure('fig-4-5b', {
  height: 300,
  title: 'Disk that 25 suspended actors hold, and what is left after their deletion',
  desc: `Four bars in MiB. With ${held.actors} suspended actors, the node holds ${held.node_snapshots_mib} MiB of snapshots and the object store holds ${held.object_store_mib} MiB. After the actors are deleted, the node holds ${after.node_snapshots_mib} MiB of snapshots and the object store still holds ${after.object_store_mib} MiB of golden snapshots.`,
}, f => {
  const c = chart(f, { x: 70, y: 40, w: 540, h: 200, xDomain: [0, 4], yDomain: [0, 12000], yTicks: [0, 4000, 8000, 12000], yLabel: 'MiB on disk, x86 server guest' });
  c.bars([
    { name: 'node snapshots', value: held.node_snapshots_mib, label: gib(held.node_snapshots_mib), hue: 'violet' },
    { name: 'object store', value: held.object_store_mib, label: gib(held.object_store_mib), hue: 'teal' },
    { name: 'node snapshots', value: after.node_snapshots_mib, label: `${after.node_snapshots_mib} MiB`, hue: 'violet' },
    { name: 'object store', value: after.object_store_mib, label: gib(after.object_store_mib), hue: 'teal' },
  ]);
  f.rule(340, 30, 340, 262, { dash: 'dashed' });
  f.text(205, 284, `${held.actors} actors suspended`, { size: 11.5, anchor: 'middle', weight: 700 });
  f.text(475, 284, 'after the actors are deleted', { size: 11.5, anchor: 'middle', weight: 700 });
});
