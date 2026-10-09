'use strict';

const { figure } = require('../../../_shared/figkit.js');

const TASK_X = 424;
const TASK_W = 196;

function task(f, cy, id, lines) {
  const h = 22 + lines.length * 15 + 12;
  const y = cy - h / 2;
  f.rect(TASK_X, y, TASK_W, h, { hue: 'amber' });
  f.text(TASK_X + 12, y + 20, `task ${id}`, { size: 12.5, weight: 700, max: TASK_W - 24 });
  lines.forEach(([kind, content], index) => {
    const state = kind === 'state';
    f.text(TASK_X + 12, y + 38 + index * 15, content, { size: 11, serif: !state, hue: state ? 'amber' : 'ink-soft', max: TASK_W - 24 });
  });
}

module.exports = figure('plate-planner-run', {
  height: 500,
  title: 'One planner, three remote agents',
  desc: 'The planner from capture/planner.py on the left and three lanes, one per delegation, in the order it ran them. In each lane the planner calls a remote agent, shown with its port and skills, and the agent runs a task shown with its states. test-runner completes with 13 passed. code-reviewer asks which base branch to use, the planner answers main, and the task completes with one finding. deployer waits in TASK_STATE_AUTH_REQUIRED until an operator approves, while the planner follows the task with SubscribeToTask, and then completes.',
}, f => {
  f.kicker(20, 18, 'client agent');
  f.kicker(256, 18, 'remote agent');
  f.kicker(TASK_X, 18, 'the task it runs');

  f.box({ x: 20, y: 36, w: 120, h: 392, hue: 'violet', pad: 8, title: 'planner', sub: ['client agent', 'reads 3 cards,', 'then delegates'] });

  const lanes = [96, 232, 368];
  f.rule(150, 164, 620, 164, { dash: 'dotted' });
  f.rule(150, 300, 620, 300, { dash: 'dotted' });

  f.beat(1);
  const tests = f.box({ x: 256, y: lanes[0] - 34, w: 150, h: 68, hue: 'blue', title: 'test-runner', sub: ['port 41241', 'skill run-tests'] });
  f.arrow([140, lanes[0]], [tests.x - 1, lanes[0]], { style: 'call', label: 'SendMessage' });
  f.beat(2);
  f.arrow(tests.right(), [TASK_X - 1, lanes[0]], { style: 'state' });
  task(f, lanes[0], '954267b7', [['state', 'TASK_STATE_COMPLETED'], ['note', 'summary.json: 13 passed']]);

  f.beat(3);
  const review = f.box({ x: 256, y: lanes[1] - 42, w: 150, h: 84, hue: 'blue', title: 'code-reviewer', sub: ['port 41242', 'skills review-diff,', 'answer-question'] });
  f.arrow([140, lanes[1] - 12], [review.x - 1, lanes[1] - 12], { style: 'call', label: 'SendMessage' });
  f.beat(4);
  f.arrow(review.right(), [TASK_X - 1, lanes[1]], { style: 'state' });
  task(f, lanes[1], '80bc7784', [['state', 'TASK_STATE_INPUT_REQUIRED'], ['note', 'asks for the base branch'], ['note', 'the planner answers: main'], ['state', 'TASK_STATE_COMPLETED'], ['note', 'review.json: 1 finding']]);
  f.beat(5);
  f.arrow([140, lanes[1] + 24], [review.x - 1, lanes[1] + 24], { style: 'call', label: 'answer: main' });

  f.beat(6);
  const deploy = f.box({ x: 256, y: lanes[2] - 42, w: 150, h: 84, hue: 'blue', title: 'deployer', sub: ['port 41243', 'skill deploy', 'bearer token required'] });
  f.arrow([140, lanes[2] - 12], [deploy.x - 1, lanes[2] - 12], { style: 'call', label: 'SendMessage' });
  f.beat(7);
  f.arrow(deploy.right(), [TASK_X - 1, lanes[2]], { style: 'state' });
  task(f, lanes[2], 'a31361b3', [['state', 'TASK_STATE_AUTH_REQUIRED'], ['note', 'waits for an operator'], ['note', 'the planner subscribes'], ['state', 'TASK_STATE_COMPLETED'], ['note', 'build live on staging']]);
  f.arrow([140, lanes[2] + 24], [deploy.x - 1, lanes[2] + 24], { style: 'call', label: 'SubscribeToTask' });

  f.beat(8);
  const operator = f.box({ x: 256, y: 452, w: 150, h: 40, hue: 'grey', title: 'operator', sub: 'outside A2A' });
  f.arrow(operator.top(), [operator.cx, deploy.y + deploy.h + 1], { style: 'effect', label: 'approves' });
});
