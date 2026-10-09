'use strict';

const { figure } = require('../../../_shared/figkit.js');

const lanes = [
  { x: 100, title: 'planner', sub: 'client agent', hue: 'violet' },
  { x: 350, title: 'code-reviewer', sub: 'remote agent', hue: 'blue' },
  { x: 556, title: 'task e5c95b09', sub: 'stored task record', hue: 'teal' },
];

const rows = [
  [0, 1, 'call', 'SendMessage', 'text and refunds.diff, no taskId'],
  [1, 2, 'state', 'TASK_STATE_INPUT_REQUIRED', 'asks: which base branch?'],
  [1, 0, 'reply', 'task, TASK_STATE_INPUT_REQUIRED', 'the blocking call returns here'],
  [0, 1, 'call', 'SendMessage: main', 'taskId e5c95b09, contextId 49c5a238'],
  [1, 2, 'write', 'history: question, main', 'the question leaves the status'],
  [1, 2, 'state', 'TASK_STATE_WORKING', 'Comparing the diff against main'],
  [1, 2, 'write', 'artifact review.json', 'a text part and a data part'],
  [1, 2, 'state', 'TASK_STATE_COMPLETED', 'status message: 2 findings'],
  [1, 0, 'reply', 'task, TASK_STATE_COMPLETED', 'review.json, four history messages'],
];

module.exports = figure('fig-input-required', {
  height: 468,
  title: 'The review question and its answer',
  desc: 'A sequence with three lifelines: the planner, the code-reviewer agent, and the stored task e5c95b09. The planner sends a diff with no task id. The reviewer moves the task to TASK_STATE_INPUT_REQUIRED with the question which base branch, and the blocking call returns the task. The planner sends main with the same task and context ids. The reviewer moves the question into history, works, adds the review.json artifact, completes the task, and returns it with four history messages.',
}, f => {
  for (const lane of lanes) {
    f.box({ x: lane.x, y: 8, w: 150, h: 38, hue: lane.hue, title: lane.title, sub: lane.sub, anchor: 'middle' });
    f.lifeline(lane.x, 46, 456);
  }
  rows.forEach(([from, to, style, label, note], index) => {
    const y = 84 + index * 44;
    f.beat(index + 1);
    f.step(24, y, index + 1);
    const x1 = lanes[from].x;
    const x2 = lanes[to].x;
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label, note, labelX: (x1 + x2) / 2 });
  });
});
