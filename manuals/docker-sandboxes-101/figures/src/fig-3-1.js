'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

module.exports = figure('fig-3-1', {
  height: 470,
  title: 'The layers of m101-demo and its doors',
  desc: 'A host row with the sbx CLI, the sandboxd daemon, the keychain, and the forward proxy on gateway.docker.internal:3128. Below a dashed hypervisor line sits the guest: the Linux 7.0.14 aarch64 kernel with 16384-byte pages on Ubuntu 26.04.1, containerd v2.3.5, a private Docker Engine 29.8.1, the agent container running as uid 1000 with sudo and docker groups, and the workspace mounted through virtiofs at the same path. A right column names five doors through the boundary: network, secret, MCP, SSH agent, and bind mount, each with the guest line that opens it.',
}, f => {
  f.kicker(20, 18, 'host · macOS 26.2 arm64 · sbx 0.47.0');
  f.box({ x: 20, y: 26, w: 90, h: 44, hue: 'grey', title: 'sbx', sub: 'CLI', titleSize: 12 });
  f.box({ x: 118, y: 26, w: 150, h: 44, hue: 'grey', title: 'sandboxd', sub: 'sandboxd.sock', titleSize: 12 });
  f.box({ x: 276, y: 26, w: 110, h: 44, hue: 'teal', title: 'keychain', sub: 'secret store', titleSize: 12 });
  f.box({ x: 394, y: 26, w: 226, h: 44, hue: 'indigo', title: 'forward proxy :3128', sub: 'gateway.docker.internal', titleSize: 12 });

  f.rule(20, 88, 620, 88, { dash: 'dashed' });
  f.text(20, 83, 'hypervisor · kern.hv_support is 1', { size: 11, hue: 'ink-soft', knock: true });

  f.kicker(20, 110, 'guest · m101-demo');
  f.rect(20, 118, 420, 330, { fill: color('paper'), stroke: color('ink-mute') });
  f.box({ x: 32, y: 130, w: 396, h: 50, hue: 'blue', title: 'kernel Linux 7.0.14 aarch64', sub: 'Ubuntu 26.04.1 LTS · getconf PAGESIZE 16384' });
  f.box({ x: 32, y: 192, w: 396, h: 50, hue: 'blue', title: 'containerd v2.3.5', sub: 'runc 1.5.1 · erofs root · overlay /' });
  f.box({ x: 32, y: 254, w: 396, h: 50, hue: 'blue', title: 'Docker Engine 29.8.1, private', sub: 'images and containers stay in the VM' });
  f.box({ x: 32, y: 316, w: 396, h: 50, hue: 'blue', title: 'agent container', sub: 'uid=1000(agent) groups sudo, docker' });
  f.box({ x: 32, y: 378, w: 396, h: 56, hue: 'green', title: '$CAPTURE/fixtures/repo', sub: ['virtiofs rw at the same path', '/etc/resolv.conf: virtiofs ro bind'] });
  f.arrow([230, 180], [230, 191], { style: 'call', packet: false });
  f.arrow([230, 242], [230, 253], { style: 'call', packet: false });
  f.arrow([230, 304], [230, 315], { style: 'call', packet: false });

  f.kicker(470, 110, 'doors');
  const doors = [
    { y: 130, hue: 'indigo', title: 'network', sub: 'HTTPS_PROXY :3128' },
    { y: 192, hue: 'teal', title: 'secret', sub: 'proxy-managed sentinel' },
    { y: 254, hue: 'olive', title: 'MCP', sub: 'MCP_GATEWAY_URL' },
    { y: 316, hue: 'grey', title: 'SSH agent', sub: '/run/ssh-agent.sock' },
    { y: 378, hue: 'green', title: 'bind mount', sub: 'host path, rw' },
  ];
  for (const door of doors) {
    const box = f.box({ x: 460, y: door.y, w: 160, h: 50, hue: door.hue, title: door.title, sub: door.sub, titleSize: 12 });
    f.arrow(box.left(), [441, box.cy], { style: 'call', hue: door.hue, packet: false });
  }
});
