'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-6-3b', {
  height: 236,
  title: 'The KVPoll states of one transfer',
  desc: 'Four states in a row: Bootstrapping 1, WaitingForInput 2, Transferring 3, and Success 4. Each moves to the next. Below them, Failed 0 can be reached from bootstrapping, waiting, and transferring.',
}, f => {
  const states = [
    { x: 20, title: 'Bootstrapping', sub: 'KVPoll 1' },
    { x: 176, title: 'WaitingForInput', sub: 'KVPoll 2' },
    { x: 332, title: 'Transferring', sub: 'KVPoll 3' },
    { x: 488, title: 'Success', sub: 'KVPoll 4' },
  ];
  f.kicker(20, 22, 'one request, one transfer');
  const boxes = states.map((state, index) => f.box({ x: state.x, y: 34, w: 140, h: 50, hue: index === 3 ? 'teal' : 'amber', title: state.title, titleSize: 12, sub: [state.sub] }));
  for (let i = 0; i < boxes.length - 1; i += 1) {
    f.arrow(boxes[i].right(), [boxes[i + 1].x - 1, boxes[i].cy], { style: 'state' });
  }
  const failed = f.box({ x: 230, y: 164, w: 180, h: 50, hue: 'rose', title: 'Failed', sub: ['KVPoll 0'] });
  for (let i = 0; i < 3; i += 1) {
    f.arrow(boxes[i].bottom(), [failed.x + 30 + i * 60, failed.y - 1], { style: 'fail' });
  }
});
