'use strict';

const { figure } = require('../../../_shared/figkit.js');

const lanes = [
  { x: 70, w: 96, hue: 'violet', title: 'planner', sub: 'client agent' },
  { x: 250, w: 112, hue: 'blue', title: 'test-runner', sub: 'remote agent' },
  { x: 416, w: 100, hue: 'teal', title: 'task store', sub: 'of test-runner', pad: 8 },
  { x: 514, w: 84, hue: 'indigo', title: 'webhook', sub: '/a2a-events', pad: 8 },
  { x: 600, w: 72, hue: 'grey', title: 'operator', sub: 'a person', pad: 7 },
];

const rows = [
  [0, 1, 'call', 'SendMessage', 'a request · solid ink', 160],
  [1, 2, 'write', 'task saved', 'a write · solid teal', 333],
  [1, 2, 'state', 'TASK_STATE_WORKING', 'state change · dashed amber', 333],
  [1, 0, 'event', 'statusUpdate', 'stream frame · dotted indigo', 160],
  [1, 3, 'event', 'push POST', 'push · dotted indigo', 333],
  [0, 4, 'effect', 'asks for approval', 'outside A2A · dashed olive', 160],
  [1, 0, 'fail', 'TaskNotFoundError', 'an error · dashed rose', 160],
  [1, 0, 'reply', 'SendMessage result', 'a reply · dashed ink', 160],
];

module.exports = figure('fig-reading-a-sequence', {
  height: 440,
  title: 'Reading a sequence figure in this manual',
  desc: 'Five lifelines: planner, test-runner, the task store of test-runner, a webhook receiver at /a2a-events, and an operator. Eight numbered rows show each arrow style once: SendMessage as a solid ink call, task saved as a solid teal write, TASK_STATE_WORKING as a dashed amber state change, a statusUpdate stream frame and a push POST as dotted indigo events, the planner asking an operator for approval as a dashed olive effect outside A2A, TaskNotFoundError as a dashed rose failure, and the SendMessage result as a dashed ink reply.',
}, f => {
  for (const lane of lanes) {
    f.box({ x: lane.x, y: 8, w: lane.w, h: 40, hue: lane.hue, title: lane.title, sub: lane.sub, titleSize: 12, anchor: 'middle', pad: lane.pad });
    f.lifeline(lane.x, 48, 432);
  }
  rows.forEach(([from, to, style, label, note, labelX], index) => {
    const y = 84 + index * 46;
    f.beat(index + 1);
    f.step(24, y, index + 1);
    const x1 = lanes[from].x;
    const x2 = lanes[to].x;
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label, note, labelX });
  });
});
