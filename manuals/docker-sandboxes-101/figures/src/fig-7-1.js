'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-7-1', {
  height: 446,
  title: 'What sbx move carries to the cloud',
  desc: 'Top row, left to right: the local sandbox m101-demo is stopped and captured as one template image, the image is uploaded, and a new cloud sandbox named moved-m101-demo plus a suffix starts from it. Below, the left column lists what travels inside the image: the sandbox filesystem, the kit network rules, the published TCP ports republished under cloud URLs, and the environment variables of the local sandbox. The right column lists what stays on the host: the bind mount, the secrets in the sbx secret store, local policy rules, and running processes, with active HTTP method rules prompting before the move. At the bottom, the destination starts a TTL clock with a one hour default and a 24 hour ceiling.',
}, f => {
  f.kicker(20, 18, 'sbx move m101-demo --to cloud');
  const src = f.box({ x: 20, y: 30, w: 200, h: 58, hue: 'blue', title: 'm101-demo', sub: ['local sandbox under sandboxd', 'stopped while it is captured'] });
  const img = f.box({ x: 260, y: 30, w: 160, h: 58, hue: 'green', title: 'template image', sub: ['the sandbox filesystem', 'one OCI image, pushed'] });
  const dst = f.box({ x: 460, y: 30, w: 160, h: 58, hue: 'blue', title: 'moved-m101-demo', sub: ['plus a unique suffix', 'new id, small shape'] });
  f.arrow(src.right(), [img.x - 1, src.cy], { style: 'write', label: 'capture' });
  f.arrow(img.right(), [dst.x - 1, img.cy], { style: 'call', label: 'upload' });

  f.kicker(20, 124, 'travels inside the image', { hue: 'green' });
  f.kicker(330, 124, 'stays on the host', { hue: 'grey' });
  const travels = [
    ['the sandbox container filesystem', 'files, packages, agent state'],
    ['kit network rules', 'example.org from env-mixin (12-kit-add.txt)'],
    ['published TCP ports', 'republished under cloud HTTPS URLs'],
    ['environment variables', 'part of the local image'],
  ];
  const stays = [
    ['host bind mount', '$CAPTURE/fixtures/repo, not in the image'],
    ['secrets in the sbx secret store', 'M101_RECV_KEY, the cloud store is separate'],
    ['local policy rules', 'local:<uuid> rules, cloud policy applies'],
    ['running processes and memory', 'the destination boots from the image'],
  ];
  travels.forEach(([title, sub], index) => {
    f.box({ x: 20, y: 134 + index * 48, w: 290, h: 40, hue: 'green', title, sub, titleSize: 12 });
  });
  stays.forEach(([title, sub], index) => {
    f.box({ x: 330, y: 134 + index * 48, w: 290, h: 40, hue: 'grey', title, sub, titleSize: 12, dash: 'dashed' });
  });
  f.path(`M300 133 V110 H${img.cx} V89`, { style: 'write' });
  f.text(150, 106, 'copied into the image', { size: 11, serif: true, hue: 'ink-soft', knock: true });
  f.box({ x: 330, y: 326, w: 290, h: 40, hue: 'rose', title: 'active HTTP method rules', sub: 'they prompt first, --force keeps the warning', titleSize: 12, dash: 'dashed' });

  const ttl = f.box({ x: 20, y: 376, w: 600, h: 58, hue: 'amber', title: 'TTL on the destination', sub: ['default 1h from the server, hard ceiling 24h from creation', '--on-timeout stop keeps it, delete removes it, sbx --cloud ttl +2h extends it'] });
  f.path(`M${dst.cx} 89 V100 H632 V${ttl.y + 29} H621`, { style: 'state' });
  f.text(586, 112, 'clock starts', { size: 11, hue: 'amber', anchor: 'middle', knock: true });
});
