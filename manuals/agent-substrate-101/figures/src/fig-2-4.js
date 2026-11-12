'use strict';

const fs = require('fs');
const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');

const log = fs.readFileSync(path.join(__dirname, '../../capture/lab/A-quickstart/60-state.log'), 'utf8').split('\n');
const pods = log.map(line => line.trim().split(/\s+/)).filter(cols => cols.length > 8 && /^\d+\/\d+$/.test(cols[2])).map(cols => ({ ns: cols[0], name: cols[1], ready: cols[2], status: cols[3] }));
const of = (ns, prefix) => pods.filter(pod => pod.ns === ns && pod.name.startsWith(prefix));
const describe = (ns, prefix, kind) => {
  const found = of(ns, prefix);
  if (!found.length) throw new Error(`fig-2-4: no pod ${ns}/${prefix}`);
  const containers = Number(found[0].ready.split('/')[1]);
  if (found[0].status === 'Completed') return 'Job, Completed';
  const count = `${found.length} ${found.length === 1 ? 'pod' : 'pods'}`;
  const each = containers === 1 ? '' : `, ${containers} containers${found.length > 1 ? ' each' : ''}`;
  if (kind && found.length === 1) return containers === 1 ? `${kind}, 1 pod` : `${kind}${each}`;
  return `${count}${each}`;
};
const system = [
  ['ate-api-server', 'blue', ''], ['ate-controller', 'blue', ''],
  ['ate-idp-server', 'blue', ''], ['atelet', 'violet', 'DaemonSet'],
  ['atenet-router', 'indigo', ''], ['atenet-egress', 'indigo', ''],
  ['k8s-credential-provider', 'indigo', ''], ['postgres-0', 'teal', 'StatefulSet'],
  ['rustfs-5', 'teal', 'object store'], ['rustfs-bucket-init', 'grey', ''],
];
const running = ns => pods.filter(pod => pod.ns === ns && pod.status === 'Running').length;

module.exports = figure('fig-2-4', {
  height: 414,
  title: 'What the install created on kind-control-plane',
  desc: `The namespace ate-system holds ${running('ate-system')} running pods and one finished Job: ate-api-server, ate-controller, ate-idp-server, atelet, atenet-router, atenet-egress, k8s-credential-provider, postgres-0, rustfs, and rustfs-bucket-init. The namespace podcertificate-controller-system holds podcertificate-controller. The namespace ate-demo-counter holds the ${running('ate-demo-counter')} worker pods of the WorkerPool counter. The namespace otel-system holds jaeger, opentelemetry-collector, and prometheus. Two boxes at the bottom say where objects live: etcd holds the three custom resources WorkerPool, SandboxConfig, and CSIDriverConfig, and Postgres holds atespaces, templates, actors, workers, and policies.`,
}, f => {
  f.kicker(20, 18, `ate-system · ${running('ate-system')} running pods, 1 finished Job`);
  f.rect(20, 26, 400, 240, { fill: color('paper'), stroke: color('ink-mute') });
  system.forEach(([prefix, hue, kind], index) => {
    const x = 28 + (index % 2) * 196;
    const y = 34 + Math.floor(index / 2) * 46;
    f.box({ x, y, w: 188, h: 40, hue, title: prefix === 'rustfs-5' ? 'rustfs' : prefix, sub: describe('ate-system', prefix, kind), titleSize: 11.5, pad: 4, dash: hue === 'grey' ? 'dashed' : undefined });
  });
  f.kicker(20, 290, 'podcertificate-controller-system');
  f.box({ x: 20, y: 298, w: 400, h: 40, hue: 'blue', title: 'podcertificate-controller', sub: `signs pod certificates, ${describe('podcertificate-controller-system', 'podcertificate-controller', '')}`, titleSize: 11.5 });
  f.kicker(436, 18, 'ate-demo-counter');
  f.box({ x: 436, y: 26, w: 184, h: 58, hue: 'violet', title: 'counter', sub: [`WorkerPool, ${running('ate-demo-counter')} worker pods`, 'image ateworker-gvisor'], titleSize: 11.5, pad: 6 });
  f.kicker(436, 110, 'otel-system');
  ['jaeger', 'opentelemetry-collector', 'prometheus'].forEach((name, index) => {
    if (!of('otel-system', name).length) throw new Error(`fig-2-4: no pod otel-system/${name}`);
    f.box({ x: 436, y: 118 + index * 36, w: 184, h: 30, hue: 'grey', title: name, titleSize: 11.5, pad: 6, weight: 400 });
  });
  f.kicker(436, 242, 'kube-system');
  f.box({ x: 436, y: 250, w: 184, h: 40, hue: 'grey', title: 'Kubernetes v1.37.0', sub: `${running('kube-system')} pods, not from Substrate`, titleSize: 11.5, pad: 6 });
  f.kicker(20, 360, 'Where the objects live');
  f.box({ x: 20, y: 368, w: 290, h: 40, hue: 'grey', title: 'etcd: 3 custom resources', sub: 'WorkerPool, SandboxConfig, CSIDriverConfig', titleSize: 12 });
  f.box({ x: 330, y: 368, w: 290, h: 40, hue: 'teal', title: 'Postgres: all other objects', sub: 'atespaces, templates, actors, workers, policies', titleSize: 12, pad: 4 });
});
