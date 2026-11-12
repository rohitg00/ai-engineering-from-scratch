'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-5-2', {
  height: 330,
  title: 'Two scopes of access policy, and the roles of each',
  desc: 'A tree. At the top, the bootstrap owners from the flag --authz-bootstrap-owners always hold owner on the global scope. Below, the global access policy named default grants owner and viewer. Under it, two atespaces named team-a and team-b each have one access policy named default that grants owner, editor and viewer. Workers belong to the global scope. System roles for atenet-router, atenet-egress, atelet, ate-controller and the ate-api-server pod come from pod certificates and no policy can grant them.',
}, f => {
  const boot = f.box({ x: 20, y: 24, w: 250, h: 56, hue: 'grey', title: '--authz-bootstrap-owners', sub: 'default: the shared ate-client' });
  const global = f.box({ x: 20, y: 122, w: 250, h: 62, hue: 'blue', title: 'global access policy', sub: ['name: default', 'roles: owner, viewer'] });
  f.arrow(boot.bottom(), [boot.cx, global.y - 1], { style: 'call', label: 'always owner' });

  const a = f.box({ x: 20, y: 236, w: 180, h: 76, hue: 'blue', title: 'atespace team-a', sub: ['access policy default', 'owner, editor, viewer'] });
  const b = f.box({ x: 220, y: 236, w: 180, h: 76, hue: 'blue', title: 'atespace team-b', sub: ['access policy default', 'owner, editor, viewer'] });
  f.path(`M${global.x + 60} ${global.y + global.h} V${a.y - 1}`, { style: 'call' });
  f.path(`M${global.x + 200} ${global.y + global.h} V210 H${b.cx} V${b.y - 1}`, { style: 'call' });
  f.text(322, 206, 'a global role holds', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(322, 222, 'in every atespace', { size: 11, serif: true, hue: 'ink-soft' });

  const workers = f.box({ x: 310, y: 122, w: 130, h: 62, hue: 'violet', title: 'workers', sub: ['global scope only'] });
  f.arrow(global.right(), [workers.x - 1, global.cy], { style: 'call' });

  f.kicker(470, 18, 'System roles');
  f.rect(460, 28, 160, 284, { hue: 'grey', dash: 'dashed' });
  const sys = [['atenet-router', 'resumes actors', 'indigo'], ['atenet-egress', 'mints actor JWTs', 'indigo'], ['atelet', 'reads egress policy', 'violet'], ['ate-controller', 'manages workers', 'blue'], ['ate-api-server', 'sidecars read actors', 'blue']];
  sys.forEach(([title, sub, hue], index) => f.box({ x: 470, y: 38 + index * 48, w: 140, h: 44, hue, title, sub, titleSize: 12, pad: 6 }));
  f.text(540, 290, 'from pod certificates', { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });
  f.text(540, 305, 'no policy grants them', { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });
});
