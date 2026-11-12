'use strict';

const { figure } = require('../../../_shared/figkit.js');
const forms = require('../../../_shared/forms.js');

const tables = ['atespaces', 'actors', 'actor_templates', 'tags', 'actor_egress_policies', 'workers', 'worker_assignments', 'leases'];
const address = ['gs://ate-snapshots/', 'atespaces/<atespace>/', 'actors/<actor uid>/', 'snapshots/<uuid>'];

module.exports = figure('fig-8-1', {
  height: 614,
  title: 'The three places that hold an actor',
  desc: 'An isometric drawing of three stores. Two ate-api-server replicas read and write actor records in a single-replica Postgres, drawn as a cylinder with one band for the actor row. On the node, atelet writes each checkpoint to the node disk, drawn as a tray that holds the node-local snapshots and the snapshot cache, and uploads it five minutes later to the object store, drawn as a bucket. With 25 suspended actors the node held 8,801 MiB of snapshots and 1,765 MiB of cache, and the bucket held 10,824 MiB. After the actors were deleted the bucket held 2,064 MiB.',
}, f => {
  const U = forms.isoView(f, { ox: 150, oy: 92, angle: 'true' });
  const D = forms.isoView(f, { ox: 176, oy: 388, angle: 'true' });
  const tag = (x, y, title, sub, hue, anchor = 'start') => {
    f.text(x, y, title, { size: 12, weight: 700, hue, anchor });
    if (sub) f.text(x, y + 15, sub, { size: 11, serif: true, hue: 'ink-soft', anchor });
  };

  forms.tower(f, U, [0, -52, 0], 'blue', { mark: { id: 'substrate', size: 38, inset: 3, rise: 38 } });
  forms.tower(f, U, [0, 8, 0], 'blue', { mark: { id: 'substrate', size: 38, inset: 3, rise: 38 } });
  const postgres = forms.cylinder(f, U, [196, 0, 0], 'teal', { r: 24, h: 66, mark: { id: 'postgresql', size: 32, drop: 3 } });
  tag(20, 158, 'ate-api-server', '2 replicas', 'blue');

  tag(410, 24, 'Postgres', 'postgres-0, 1 replica', 'teal');
  f.kicker(410, 62, 'tables', { hue: 'teal' });
  tables.forEach((name, index) => f.text(410, 79 + index * 16, name, { size: 11, hue: name === 'actors' ? 'teal' : undefined, weight: name === 'actors' ? 700 : undefined }));
  f.leader([404, 91], postgres.rim(9.5), { hue: 'teal' });
  f.text(410, 213, 'no actor is in etcd', { size: 11, serif: true, hue: 'ink-soft' });

  forms.slab(f, D, [-34, -52, 0], 'grey', { w: 324, d: 124, mark: { id: 'kubernetes', size: 40, at: [258, 44] } });
  const atelet = forms.unit(f, D, [0, -18, 0], 'violet');
  const tray = forms.shell(f, D, [130, -34, 0], 'violet', { w: 132, d: 68, h: 9, lip: 9 });
  forms.sheets(f, D, [140, -20, 3], 'teal', { size: 40, count: 5, gap: 3.5 });
  forms.sheets(f, D, [202, -20, 3], 'teal', { size: 40, count: 2, gap: 3.5 });
  tray.front();
  const bucket = forms.bucket(f, D, [18, -214, 0], 'teal');

  tag(atelet.left[0] - 6, atelet.left[1] - 44, 'atelet', 'one on each node', 'violet', 'end');
  tag(452, 262, 'object store', 'rustfs on kind, 1 pod', 'teal');
  f.kicker(452, 300, 'snapshot address', { hue: 'teal' });
  address.forEach((part, index) => f.text(452 + index * 8, 317 + index * 16, part, { size: 11 }));
  f.kicker(452, 392, 'measured', { hue: 'teal' });
  f.text(452, 409, '10,824 MiB, 25 actors', { size: 11 });
  f.text(452, 425, '2,064 MiB after delete', { size: 11 });
  f.text(452, 444, 'golden snapshots stay', { size: 11, serif: true, hue: 'ink-soft' });

  tag(20, 506, 'node disk', '/var/lib/ate', 'violet');
  f.kicker(20, 544, 'directories', { hue: 'violet' });
  f.kicker(176, 544, 'measured', { hue: 'violet' });
  f.text(20, 561, 'snapshots/<actor uid>', { size: 11 });
  f.text(176, 561, '8,801 MiB', { size: 11 });
  f.leader([240, 557], D.P(140, 20, 3), { hue: 'teal' });
  f.text(20, 577, 'snapshot-cache/', { size: 11 });
  f.text(176, 577, '1,765 MiB', { size: 11 });
  f.leader([240, 573], D.P(202, 20, 3), { hue: 'teal' });
  f.text(20, 596, 'copy stays 30 minutes', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(430, 574, 'the node', { size: 11, serif: true, hue: 'ink-mute' });

  f.beat(1);
  f.isoFlow(U, [[58, 0, 0], [166, 0, 0]], { style: 'write' });
  f.text(...U.P(112, 0, 15), 'each call', { size: 11.5, hue: 'teal', anchor: 'middle', knock: true });
  f.beat(2);
  f.isoFlow(D, [[40, 0, 0], [126, 0, 0]], { style: 'write' });
  f.text(...D.P(83, 0, 15), 'checkpoint', { size: 11.5, hue: 'teal', anchor: 'middle', knock: true });
  f.beat(3);
  f.isoFlow(D, [[18, -22, 0], [18, -186, 0]], { style: 'write' });
  f.text(...D.P(18, -104, 15), 'upload, 5 min later', { size: 11.5, hue: 'teal', anchor: 'middle', knock: true });
});
