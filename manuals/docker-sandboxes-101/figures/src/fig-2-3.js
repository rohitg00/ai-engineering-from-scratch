'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-2-3', {
  height: 345,
  title: 'The sandboxd state directory on macOS',
  desc: 'Two roots at the top: com.docker.sandboxes under Application Support, which holds sandboxes/sandboxd with sandboxd.sock and daemon.log and sandboxes/agent-skills, and com.docker.sandboxes under Logs, which holds sandboxes/auditkit with the audit JSONL files. Below, the symlink ~/.sbx/run points at the state directory and holds the containerd ttrpc socket, and a greyed box shows ~/.docker/sandboxes, the tree of the 2025 plugin.',
}, f => {
  const root = f.box({ x: 20, y: 30, w: 240, h: 50, hue: 'blue', title: 'com.docker.sandboxes/', sub: ['~/Library/Application Support/'] });
  const logs = f.box({ x: 385, y: 30, w: 240, h: 50, hue: 'teal', title: 'com.docker.sandboxes/', sub: ['~/Library/Logs/'] });
  const daemon = f.box({ x: 20, y: 120, w: 170, h: 64, hue: 'blue', title: 'sandboxes/sandboxd/', sub: ['sandboxd.sock', 'daemon.log'] });
  const skills = f.box({ x: 200, y: 120, w: 165, h: 64, hue: 'green', title: 'agent-skills/', sub: ['sandboxes/agent-skills/', 'shared skills store'] });
  const audit = f.box({ x: 385, y: 120, w: 240, h: 64, hue: 'teal', title: 'sandboxes/auditkit/', sub: ['audit-<utc-timestamp>-', '<process-uuid>-<seq>.jsonl'] });
  f.path(`M${root.cx} 80 V100 H${daemon.cx} V120`, { style: 'call', hue: 'ink-mute', head: false });
  f.path(`M${root.cx} 100 H${skills.cx} V120`, { style: 'call', hue: 'ink-mute', head: false });
  f.path(`M${logs.cx} 80 V120`, { style: 'call', hue: 'ink-mute', head: false });
  const link = f.box({ x: 20, y: 220, w: 240, h: 64, hue: 'blue', dash: 'dashed', title: '~/.sbx/run', sub: ['symlink to the state directory', 'd/containerd/containerd.sock.ttrpc'] });
  f.path(`M20 65 H10 V${link.cy} H19`, { style: 'call', hue: 'ink-mute', dash: 'dashed' });
  f.box({ x: 385, y: 220, w: 240, h: 80, hue: 'grey', dash: 'dashed', title: '~/.docker/sandboxes/', sub: ['vm/<name>/, image-cache/', 'the 2025 docker sandbox plugin', 'deleted by docker sandbox reset'] });
  f.text(20, 330, 'dashed border: a symlink, or the plugin tree that sbx does not use · teal: stored records', { size: 11, serif: true, hue: 'ink-soft' });
});
