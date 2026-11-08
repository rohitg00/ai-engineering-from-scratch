'use strict';

const { figure } = require('../figkit.js');

module.exports = figure('tpl-tree', {
  height: 254,
  title: 'One ownership tree',
  desc: 'A root conversation owns three children: a generate task, a tool task and a forked conversation. The tool task owns a child conversation, which in turn owns its own generate task, so cancelling the tool task reaches everything below it.',
}, f => {
  const root = f.box({ x: 230, y: 16, w: 180, h: 42, hue: 'blue', title: 'conversation 1', sub: 'the root' });
  const children = [
    f.box({ x: 20, y: 110, w: 180, h: 44, hue: 'amber', title: 'task 9 · generate', sub: 'one model call' }),
    f.box({ x: 230, y: 110, w: 180, h: 44, hue: 'amber', title: 'task 12 · tool', sub: 'one tool call' }),
    f.box({ x: 440, y: 110, w: 180, h: 44, hue: 'blue', title: 'conversation 10', sub: 'a fork at entry 8' }),
  ];
  f.path(`M${root.cx} 58 V84 H${children[0].cx} V110`, { style: 'call', hue: 'ink-mute', head: false });
  f.path(`M${root.cx} 84 V110`, { style: 'call', hue: 'ink-mute', head: false });
  f.path(`M${root.cx} 84 H${children[2].cx} V110`, { style: 'call', hue: 'ink-mute', head: false });
  const child = f.box({ x: 230, y: 198, w: 180, h: 44, hue: 'blue', title: 'conversation 14', sub: 'owned by task 12' });
  f.box({ x: 440, y: 198, w: 180, h: 44, hue: 'amber', title: 'task 15 · generate', sub: 'the child runs' });
  f.path(`M${child.cx} 154 V198`, { style: 'call', hue: 'ink-mute', head: false });
  f.path('M410 220 H440', { style: 'call', hue: 'ink-mute', head: false });
  f.text(328, 180, 'owns', { size: 11, serif: true, hue: 'ink-soft' });
});
