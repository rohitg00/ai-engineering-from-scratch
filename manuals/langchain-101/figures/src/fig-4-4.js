'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

module.exports = figure('fig-4-4', {
  height: 340,
  title: 'The namespaces of the kit store',
  desc: 'A tree of namespace labels. The root label users has two children, ada and grace. ada has two children, memories with the keys m1 and m2, and settings with the key theme. grace has one child, memories with the key m1. A shaded area covers ada and both of its children, which is what search with the prefix users, ada returns. grace is outside it.',
}, f => {
  f.rect(20, 124, 372, 172, { fill: color('teal-fill'), stroke: color('teal-ink'), dash: 'dashed' });
  f.text(32, 288, "search(('users', 'ada'))", { size: 11.5, hue: 'teal', weight: 700 });
  const node = (cx, y, title, sub, hue) => f.box({ x: cx, y, w: 150, h: sub ? 44 : 34, hue, title, sub, anchor: 'middle', titleSize: 12 });
  const root = node(320, 16, 'users', null, 'grey');
  const ada = node(206, 132, 'ada', null, 'violet');
  const grace = node(500, 132, 'grace', null, 'violet');
  const join = (parent, child) => f.path(`M${parent.cx} ${parent.y + parent.h} L${parent.cx} ${child.y - 14} L${child.cx} ${child.y - 14} L${child.cx} ${child.y - 1}`, { style: 'call', head: false });
  join(root, ada);
  join(root, grace);
  const mem = node(110, 222, 'memories', 'keys m1, m2', 'teal');
  const set = node(300, 222, 'settings', 'key theme', 'teal');
  const gmem = node(500, 222, 'memories', 'key m1', 'teal');
  join(ada, mem);
  join(ada, set);
  join(grace, gmem);
  f.text(20, 314, "list_namespaces(max_depth=2) stops at the second row: ('users', 'ada') and ('users', 'grace').", { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 332, 'A user label is a full label. The prefix users, ali matches nothing.', { size: 11, serif: true, hue: 'ink-soft' });
});
