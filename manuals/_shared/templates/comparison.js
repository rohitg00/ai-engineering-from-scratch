'use strict';

const { figure } = require('../figkit.js');

module.exports = figure('tpl-comparison', {
  height: 236,
  title: 'Two ways to answer one request',
  desc: 'Two columns side by side. On the left the server answers with a message, so the client gets the whole answer at once and has nothing to follow. On the right the server answers with a task, so the client gets an id and follows the task until it completes.',
}, f => {
  f.kicker(20, 18, 'A · returns a message');
  f.kicker(336, 18, 'B · returns a task');
  f.rule(320, 8, 320, 228, { dash: 'dashed' });
  const left = [
    { hue: 'violet', title: 'request', sub: 'one message in' },
    { hue: 'blue', title: 'message reply', sub: 'the whole answer, now' },
    { hue: 'grey', title: 'nothing to follow', sub: 'no id, no state', dash: 'dashed' },
  ];
  const right = [
    { hue: 'violet', title: 'request', sub: 'one message in' },
    { hue: 'amber', title: 'task, state working', sub: 'an id to follow' },
    { hue: 'amber', title: 'task, state completed', sub: 'artifacts attached' },
  ];
  [[left, 20], [right, 336]].forEach(([column, x]) => {
    column.forEach((item, index) => {
      const y = 30 + index * 70;
      f.box({ x, y, w: 284, h: 44, ...item });
      if (index < column.length - 1) f.arrow([x + 142, y + 44], [x + 142, y + 69], { style: index === 0 ? 'call' : 'state' });
    });
  });
});
