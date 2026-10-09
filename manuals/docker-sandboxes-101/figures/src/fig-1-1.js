'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

module.exports = figure('fig-1-1', {
  height: 452,
  title: 'What sbx owns and what docker-agent owns',
  desc: 'Two columns over two bands. In the host band, sbx owns the sbx v0.47.0 CLI, the sandboxd daemon on its socket, the macOS Keychain that holds secrets, and the proxy on gateway.docker.internal:3128. docker-agent owns the docker-agent v1.149.0 binary, the agent file, the staged kit under sandbox-kits, and the persistent allowlist with localhost:12434. A dashed line marks the hypervisor. In the guest band, sbx owns the Linux 7.0.14 kernel, the private Docker Engine 29.8.1, the virtiofs workspace mount at the same path, and the environment with proxy variables and proxy-managed keys. docker-agent owns only the loop inside: the docker-agent process, its filesystem and shell tools, and its model call.',
}, f => {
  f.text(20, 18, 'owned by sbx', { size: 12, weight: 700, hue: 'blue' });
  f.text(336, 18, 'owned by docker-agent', { size: 12, weight: 700, hue: 'violet' });
  f.rule(320, 8, 320, 444, { dash: 'dashed' });

  f.kicker(20, 42, 'host · macOS 26.2 arm64');
  const host = [
    { x: 20, y: 50, hue: 'blue', title: 'sbx v0.47.0', sub: 'the CLI you type' },
    { x: 164, y: 50, hue: 'blue', title: 'sandboxd', sub: 'sandboxd.sock' },
    { x: 20, y: 110, hue: 'teal', title: 'Keychain', sub: 'sbx secret set' },
    { x: 164, y: 110, hue: 'indigo', title: 'proxy :3128', sub: 'policy, key swap' },
  ];
  for (const item of host) f.box({ ...item, w: 140, h: 46, titleSize: 12 });
  const agentHost = [
    { x: 336, y: 50, hue: 'violet', title: 'docker-agent', sub: 'v1.149.0, Homebrew' },
    { x: 482, y: 50, hue: 'violet', title: 'agent file', sub: 'files-sandbox.yaml' },
    { x: 336, y: 110, hue: 'green', title: 'sandbox-kits/<hash>', sub: 'the staged kit' },
    { x: 482, y: 110, hue: 'teal', title: 'allowlist', sub: 'localhost:12434' },
  ];
  for (const item of agentHost) f.box({ ...item, w: 138, h: 46, titleSize: 11, pad: 5 });

  f.rule(20, 178, 620, 178, { dash: 'dashed' });
  f.text(30, 182, 'Hypervisor.framework · kern.hv_support: 1', { size: 11, hue: 'ink-soft', knock: true });

  f.kicker(20, 208, 'guest · one microVM per sandbox');
  f.rect(20, 216, 290, 228, { fill: color('paper'), stroke: color('ink-mute') });
  const guest = [
    { y: 226, hue: 'blue', title: 'Linux 7.0.14 aarch64', sub: 'its own kernel, Ubuntu 26.04.1' },
    { y: 280, hue: 'blue', title: 'Docker Engine 29.8.1', sub: 'its containers stay out of docker ps' },
    { y: 334, hue: 'green', title: 'workspace mount', sub: 'virtiofs rw, same absolute path' },
    { y: 388, hue: 'indigo', title: 'environment', sub: 'HTTPS_PROXY, keys proxy-managed' },
  ];
  for (const item of guest) f.box({ x: 30, w: 270, h: 46, titleSize: 12, ...item });

  f.rect(336, 216, 284, 228, { fill: color('paper'), stroke: color('ink-mute') });
  const loop = [
    { y: 226, hue: 'violet', title: 'docker-agent process', sub: 'the loop: model, tools, sub-agents' },
    { y: 280, hue: 'olive', title: 'filesystem, shell', sub: 'tools that run in the VM' },
    { y: 334, hue: 'plum', title: 'model call', sub: 'host.docker.internal:12434' },
  ];
  for (const item of loop) f.box({ x: 346, w: 264, h: 46, titleSize: 12, ...item });
  f.text(478, 414, 'nothing else in the guest', { size: 11, serif: true, italic: true, hue: 'ink-soft', anchor: 'middle' });
});
