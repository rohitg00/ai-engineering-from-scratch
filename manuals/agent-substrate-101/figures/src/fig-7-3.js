'use strict';

const { figure } = require('../../../_shared/figkit.js');

const project = [
  { hue: 'grey', title: 'GKE Standard cluster', sub: 'version 1.37, Rapid channel, Dataplane V2' },
  { hue: 'teal', title: 'two Cloud Storage buckets', sub: 'snapshots, and the microVM kernel and rootfs' },
  { hue: 'grey', title: 'Artifact Registry: ate-images', sub: 'the images that the installer builds' },
  { hue: 'grey', title: 'ate-snapshot-transfer', sub: 'a service account, with its IAM grants' },
  { hue: 'grey', title: 'Cloud Monitoring dashboards', sub: 'routing latency, snapshot size, gRPC traffic' },
];
const cluster = [
  { hue: 'blue', title: 'ate-api-server', sub: 'with ate-controller and ate-idp-server' },
  { hue: 'indigo', title: 'atenet-router, atenet-egress', sub: 'the dataplane' },
  { hue: 'violet', title: 'atelet', sub: 'a privileged DaemonSet on every node' },
  { hue: 'teal', title: 'PostgreSQL', sub: 'one StatefulSet on a 500 GiB disk' },
  { hue: 'violet', title: 'WorkerPool, SandboxConfig', sub: 'the two CRDs, and the CAs for mTLS' },
];

module.exports = figure('fig-7-3', {
  height: 396,
  title: 'What the GKE installer creates, and who operates it',
  desc: 'The installer runs on your machine and calls two tools. The setup-gcp tool creates five things in your Google Cloud project: a GKE Standard cluster, two buckets, an Artifact Registry repository, a service account, and dashboards. The ate-setup tool installs five things in the cluster that you operate: the control plane, the dataplane, atelet, PostgreSQL on a 500 GiB disk, and the CRDs.',
}, f => {
  f.box({ x: 20, y: 12, w: 600, h: 40, hue: 'grey', title: 'the installer, on your machine', sub: 'git, Go, and Docker with buildx. It does not run in Cloud Shell.', titleSize: 12 });
  f.arrow([165, 52], [165, 92], { style: 'call', label: 'setup-gcp' });
  f.arrow([475, 52], [475, 92], { style: 'call', label: 'ate-setup' });
  f.kicker(20, 110, 'in your Google Cloud project');
  f.kicker(330, 110, 'in the cluster, operated by you');
  project.forEach((item, index) => f.box({ x: 20, y: 120 + index * 54, w: 290, h: 44, titleSize: 11.5, ...item }));
  cluster.forEach((item, index) => f.box({ x: 330, y: 120 + index * 54, w: 290, h: 44, titleSize: 11.5, ...item }));
});
