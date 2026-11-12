'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-2-2', {
  height: 300,
  title: 'Where kubectl ate and kubectl read from',
  desc: 'Two rows. In the top row kubectl ate get actors opens a port-forward through kube-apiserver to the Service api on port 443, where ate-api-server answers from Postgres. The token it sends belongs to the shared identity system:serviceaccount:ate-system:ate-client unless you pass --token-file. In the bottom row kubectl get workerpools asks kube-apiserver, which answers from etcd, because WorkerPool, SandboxConfig, and CSIDriverConfig are the only custom resources.',
}, f => {
  f.kicker(20, 18, 'atespaces, templates, actors, workers, policies');
  const cli = f.box({ x: 20, y: 28, w: 150, h: 46, hue: 'olive', title: 'kubectl ate', sub: 'get actors -A' });
  const kube = f.box({ x: 200, y: 28, w: 130, h: 46, hue: 'grey', title: 'kube-apiserver', sub: 'port-forward', titleSize: 12 });
  const api = f.box({ x: 360, y: 28, w: 130, h: 46, hue: 'blue', title: 'ate-api-server', sub: 'Service api:443', titleSize: 12 });
  const pg = f.box({ x: 520, y: 28, w: 100, h: 46, hue: 'teal', title: 'Postgres', sub: 'rows' });
  f.beat(1);
  f.arrow(cli.right(), [kube.x - 1, cli.cy], { style: 'call' });
  f.arrow(kube.right(), [api.x - 1, cli.cy], { style: 'call' });
  f.beat(2);
  f.arrow(api.right(), [pg.x - 1, cli.cy], { style: 'call' });
  f.beat(3);
  f.box({ x: 20, y: 98, w: 600, h: 46, hue: 'olive', align: 'left', title: 'acting as system:serviceaccount:ate-system:ate-client', sub: 'the shared identity of every caller that passes no --token-file', titleSize: 12, dash: 'dashed' });
  f.rule(95, 74, 95, 98, { hue: 'olive', dash: 'dashed' });
  f.beat(0);
  f.rule(20, 168, 620, 168, { dash: 'dashed' });
  f.kicker(20, 192, 'WorkerPool, SandboxConfig, CSIDriverConfig');
  const k = f.box({ x: 20, y: 202, w: 150, h: 46, hue: 'olive', title: 'kubectl', sub: 'get workerpools -A' });
  const kube2 = f.box({ x: 200, y: 202, w: 130, h: 46, hue: 'grey', title: 'kube-apiserver', sub: 'ate.dev/v1', titleSize: 12 });
  const etcd = f.box({ x: 360, y: 202, w: 130, h: 46, hue: 'grey', title: 'etcd', sub: 'the 3 CRDs' });
  f.beat(4);
  f.arrow(k.right(), [kube2.x - 1, k.cy], { style: 'call' });
  f.arrow(kube2.right(), [etcd.x - 1, k.cy], { style: 'call' });
  f.beat(0);
  f.text(20, 274, 'kubectl get actor finds nothing: an actor is a row in Postgres, not a custom resource.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 290, 'With --endpoint, kubectl ate skips the port-forward and dials ate-api-server directly.', { size: 11, serif: true, hue: 'ink-soft' });
});
