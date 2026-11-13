'use strict';

const fs = require('fs');
const path = require('path');
const { figure, measure } = require('../../../_shared/figkit.js');
const forms = require('../../../_shared/forms.js');

const log = fs.readFileSync(path.join(__dirname, '../../capture/lab/A-quickstart/60-state.log'), 'utf8').split('\n');
const pods = log.map(line => line.trim().split(/\s+/)).filter(cols => cols.length > 8 && cols[0] === 'ate-system' && /^\d+\/\d+$/.test(cols[2])).map(cols => ({ name: cols[1], ready: cols[2], status: cols[3] }));
const of = prefix => {
  const found = pods.filter(pod => pod.name.startsWith(prefix));
  if (!found.length) throw new Error(`fig-2-4b: no pod ate-system/${prefix}`);
  return found;
};
const describe = (prefix, kind) => {
  const found = of(prefix);
  const containers = Number(found[0].ready.split('/')[1]);
  if (found[0].status === 'Completed') return 'Job, Completed';
  const each = containers === 1 ? '' : `, ${containers} containers${found.length > 1 ? ' each' : ''}`;
  if (kind) return containers === 1 ? `${kind}, 1 pod` : `${kind}${each}`;
  return `${found.length} ${found.length === 1 ? 'pod' : 'pods'}${each}`;
};
const running = pods.filter(pod => pod.status === 'Running').length;
const finished = pods.filter(pod => pod.status === 'Completed').length;

const PITCH = 76;
const FRONT = 60;
const SUBSTRATE = { id: 'substrate', size: 30, inset: 3, rise: 35 };
const ENVOY = { id: 'envoy', size: 32, inset: 6, rise: 25 };
const columns = [
  { back: { name: 'ate-api-server', prefix: 'ate-api-server', hue: 'blue', form: 'tower', mark: SUBSTRATE } },
  { back: { name: 'ate-idp-server', prefix: 'ate-idp-server', hue: 'blue', form: 'tower', mark: SUBSTRATE } },
  {
    back: { name: 'ate-controller', prefix: 'ate-controller', hue: 'blue', form: 'tower', mark: SUBSTRATE },
    front: { name: 'k8s-credential-provider', prefix: 'k8s-credential-provider', hue: 'indigo', form: 'unit' },
  },
  {
    back: { name: 'postgres-0', prefix: 'postgres-0', hue: 'teal', form: 'cylinder', kind: 'StatefulSet' },
    front: { name: 'rustfs', prefix: 'rustfs-5', hue: 'teal', form: 'bucket', kind: 'object store' },
  },
  {
    back: { name: 'atenet-router', prefix: 'atenet-router', hue: 'indigo', form: 'gateway', mark: ENVOY },
    front: { name: 'atenet-egress', prefix: 'atenet-egress', hue: 'indigo', form: 'gateway', mark: ENVOY },
  },
  {
    back: { name: 'atelet', prefix: 'atelet', hue: 'violet', form: 'unit', kind: 'DaemonSet' },
    front: { name: 'rustfs-bucket-init', prefix: 'rustfs-bucket-init', hue: 'grey', form: 'unit', ghost: true },
  },
];

module.exports = figure('fig-2-4b', {
  height: 448,
  title: 'The pods of ate-system on kind-control-plane',
  desc: `An isometric drawing of the namespace ate-system as one floor tile on the node kind-control-plane, which carries the Kubernetes mark. The tile holds ${running} running pods and ${finished} finished Job, one object for each pod. Two ate-api-server towers and two ate-idp-server towers stand side by side, and one ate-controller tower stands alone, all with the Agent Substrate mark. postgres-0 is a cylinder and rustfs is a bucket. atenet-router and atenet-egress are gateway units with the Envoy mark. atelet and k8s-credential-provider are small units, and the finished Job rustfs-bucket-init is a dashed outline.`,
}, f => {
  const V = forms.isoView(f, { ox: 170, oy: 104, angle: 'true' });
  const tag = (x, y, title, sub, hue, anchor = 'start') => {
    f.text(x, y, title, { size: 11.5, weight: 700, hue, anchor });
    f.text(x, y + 14, sub, { size: 11, serif: true, hue: 'ink-soft', anchor });
  };
  const draw = (item, x, y) => {
    if (item.form === 'tower') return forms.tower(f, V, [x, y, 0], item.hue, { w: 36, d: 36, h: 44, mark: item.mark });
    if (item.form === 'gateway') return forms.gateway(f, V, [x - 4, y - 4, 0], item.hue, { w: 44, d: 44, h: 26, ports: 4, mark: item.mark });
    if (item.form === 'cylinder') return forms.cylinder(f, V, [x + 18, y + 14, 0], item.hue, { r: 20, h: 52, mark: { id: 'postgresql', size: 27, drop: 2.5 } });
    if (item.form === 'bucket') return forms.bucket(f, V, [x + 20, y + 24, 0], item.hue, { k: 0.8 });
    return forms.unit(f, V, [x, y, 0], item.hue, { w: 36, d: 36, h: 26, ghost: item.ghost });
  };

  f.kicker(20, 18, `ate-system · ${running} running pods, ${finished} finished Job`);
  forms.slab(f, V, [-28, -28, 0], 'grey', { w: 520, d: 156, mark: { id: 'kubernetes', size: 38, at: [464, 50] } });
  forms.tile(f, V, [-14, -14, 0], 'grey', { w: 450, d: 128 });

  const labels = [];
  columns.forEach((column, index) => {
    const x = index * PITCH;
    const count = of(column.back.prefix).length;
    const back = draw(column.back, x, 0);
    labels.push({ item: column.back, at: column.back.form === 'cylinder' ? back.center : back.top, side: 'back' });
    if (column.front) labels.push({ item: column.front, at: draw(column.front, x, FRONT).left || null, anchor: column.front, x, side: 'front' });
    else if (count > 1) draw(column.back, x, FRONT);
  });

  const LIFT = { tower: 18, gateway: 22, unit: 18, cylinder: 14 };
  for (const label of labels.filter(entry => entry.side === 'back')) {
    const [x, y] = label.at;
    const sub = describe(label.item.prefix, label.item.kind);
    const lift = LIFT[label.item.form];
    tag(Math.min(x - 8, 630 - measure(sub, 11, true)), y - lift - 20, label.item.name, sub, label.item.hue);
    f.leader([x, y - lift - 2], [x, y], { hue: label.item.hue });
  }
  for (const label of labels.filter(entry => entry.side === 'front')) {
    const [x, y] = V.P(label.x, FRONT + 36, 0);
    tag(x - 30, y + 52, label.item.name, describe(label.item.prefix, label.item.kind), label.item.hue, 'end');
    f.leader([x - 26, y + 48], [x + 6, y + 2], { hue: label.item.hue });
  }
  f.text(20, 58, 'namespace ate-system', { size: 11, serif: true, hue: 'ink-mute' });
  f.leader([50, 64], V.P(-14, 96, 0), { hue: 'ink-mute' });
  f.text(620, 424, 'node', { size: 11, serif: true, hue: 'ink-mute', anchor: 'end' });
  f.text(620, 440, 'kind-control-plane', { size: 12, weight: 700, hue: 'grey', anchor: 'end' });
});
