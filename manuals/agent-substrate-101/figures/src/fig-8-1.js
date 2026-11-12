'use strict';

const { figure } = require('../../../_shared/figkit.js');

const tables = ['atespaces', 'actors', 'actor_templates', 'tags', 'actor_egress_policies', 'workers', 'worker_assignments', 'leases'];
const address = ['gs://ate-snapshots/', 'atespaces/<atespace>/', 'actors/<actor uid>/', 'snapshots/<uuid>'];

module.exports = figure('fig-8-1', {
  height: 372,
  title: 'The three places that hold an actor',
  desc: 'ate-api-server reads and writes actor records in a single-replica Postgres. atelet writes each checkpoint to the node disk and uploads it to the object store five minutes later. With 25 suspended actors the node held 8,801 MiB of snapshots and the bucket held 10,824 MiB.',
}, f => {
  const api = f.box({ x: 35, y: 24, w: 160, h: 44, hue: 'blue', title: 'ate-api-server', sub: ['2 replicas'] });
  const atelet = f.box({ x: 400, y: 24, w: 160, h: 44, hue: 'violet', title: 'atelet', sub: ['one on each node'] });

  f.rect(20, 118, 190, 234, { hue: 'teal' });
  f.text(32, 138, 'Postgres', { size: 12.5, weight: 700 });
  f.text(32, 154, 'postgres-0, 1 replica', { size: 11, serif: true, hue: 'ink-soft' });
  f.kicker(32, 178, 'tables', { hue: 'teal' });
  tables.forEach((name, index) => f.text(32, 196 + index * 16, name, { size: 11 }));
  f.text(32, 338, 'no actor is in etcd', { size: 11, serif: true, hue: 'ink-soft' });

  f.rect(225, 118, 190, 234, { hue: 'teal' });
  f.text(237, 138, 'object store', { size: 12.5, weight: 700 });
  f.text(237, 154, 'rustfs on kind, 1 pod', { size: 11, serif: true, hue: 'ink-soft' });
  f.kicker(237, 178, 'snapshot address', { hue: 'teal' });
  address.forEach((part, index) => f.text(237 + index * 8, 196 + index * 16, part, { size: 11 }));
  f.kicker(237, 282, 'measured', { hue: 'teal' });
  f.text(237, 300, '10,824 MiB, 25 actors', { size: 11 });
  f.text(237, 316, '2,064 MiB after delete', { size: 11 });
  f.text(237, 338, 'golden snapshots stay', { size: 11, serif: true, hue: 'ink-soft' });

  f.rect(430, 118, 190, 234, { hue: 'violet' });
  f.text(442, 138, 'node disk', { size: 12.5, weight: 700 });
  f.text(442, 154, '/var/lib/ate', { size: 11, serif: true, hue: 'ink-soft' });
  f.kicker(442, 178, 'directories', { hue: 'violet' });
  f.text(442, 196, 'snapshots/<actor uid>', { size: 11 });
  f.text(442, 212, 'snapshot-cache/', { size: 11 });
  f.kicker(442, 282, 'measured', { hue: 'violet' });
  f.text(442, 300, '8,801 MiB snapshots', { size: 11 });
  f.text(442, 316, '1,765 MiB cache', { size: 11 });
  f.text(442, 338, 'copy stays 30 minutes', { size: 11, serif: true, hue: 'ink-soft' });

  f.arrow([api.cx, 68], [api.cx, 117], { style: 'write', label: 'each call' });
  f.arrow([525, 68], [525, 117], { style: 'write', label: 'checkpoint' });
  f.path('M435 68 V94 H320 V117', { style: 'write' });
  f.text(428, 88, 'upload, 5 min later', { size: 11.5, hue: 'teal', anchor: 'end' });
});
