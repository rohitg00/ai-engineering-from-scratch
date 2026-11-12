'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-4-2', {
  height: 356,
  title: 'What sits between an actor and the node in each sandbox class',
  desc: 'Two columns of stacked layers, read from the node at the bottom to the actor at the top. In the gvisor class, a worker pod runs ateworker-gvisor, which starts one runsc Sentry for each actor, and every container of the actor shares that Sentry. In the microvm class, the node must have the device /dev/kvm, a worker pod runs ateworker-microvm, which starts Cloud Hypervisor and virtiofsd, and the containers of the actor run on a guest kernel with one cgroup each.',
}, f => {
  f.kicker(20, 18, 'Class gvisor');
  f.kicker(336, 18, 'Class microvm');
  f.rule(320, 8, 320, 348, { dash: 'dashed' });
  const left = [
    { hue: 'green', title: 'actor containers', sub: 'limits apply to the actor as a whole' },
    { hue: 'violet', title: 'runsc Sentry', sub: 'a kernel in user space, one for each actor' },
    { hue: 'violet', title: 'worker pod, ateworker-gvisor', sub: 'root, SYS_ADMIN, NET_ADMIN' },
    { hue: 'grey', title: 'node', sub: 'any Linux node' },
  ];
  const right = [
    { hue: 'green', title: 'actor containers', sub: 'one guest cgroup for each container' },
    { hue: 'violet', title: 'guest kernel', sub: 'Kata guest on Cloud Hypervisor, virtiofsd' },
    { hue: 'violet', title: 'worker pod, ateworker-microvm', sub: 'root, SYS_ADMIN, NET_ADMIN' },
    { hue: 'grey', title: 'node with /dev/kvm', sub: 'atelet offers it as ate.dev/kvm' },
  ];
  [[left, 20], [right, 336]].forEach(([column, x]) => {
    column.forEach((item, index) => {
      const y = 30 + index * 68;
      f.box({ x, y, w: 284, h: 48, ...item });
      if (index < column.length - 1) f.arrow([x + 142, y + 67], [x + 142, y + 49], { style: 'call' });
    });
  });
  f.text(20, 318, 'snapshot of files: runsc checkpoint bundles', { size: 11, serif: true, hue: 'teal' });
  f.text(336, 318, 'snapshot of files: tar archives', { size: 11, serif: true, hue: 'teal' });
  f.text(20, 338, 'minimum memory limit: none', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(336, 338, 'minimum memory limit: 128 MiB', { size: 11, serif: true, hue: 'ink-soft' });
});
