'use strict';

const { figure } = require('../../../_shared/figkit.js');

const W = 192;
const XS = [20, 224, 428];
const ROW = [116, 186, 256, 326, 396];
const H = 44;

function lane(f, index, card, steps) {
  const x = XS[index];
  const mid = x + W / 2;
  let previous = null;
  steps.forEach((step, row) => {
    f.beat(step.beat);
    if (row === 0) f.arrow([mid, card.y + card.h], [mid, ROW[0] - 1], { style: 'call', label: step.label });
    else f.arrow([mid, previous.y + H], [mid, ROW[row] - 1], { style: step.arrow, label: step.label });
    previous = f.box({ x, y: ROW[row], w: W, h: H, hue: step.hue, dash: step.dash, double: step.double, title: step.title, sub: step.sub, titleSize: step.titleSize || 12, pad: 8 });
  });
  return previous;
}

function decision(f, index, beat, end, title, sub) {
  f.beat(beat);
  const mid = XS[index] + W / 2;
  f.arrow([mid, end.y + end.h], [mid, 475], { style: 'call', hue: 'ink-mute' });
  if (index > 0) f.arrow([XS[index - 1] + W, 498], [XS[index] - 1, 498], { style: 'call' });
  return f.box({ x: XS[index], y: 476, w: W, h: 44, hue: 'violet', title, sub, titleSize: 12 });
}

module.exports = figure('fig-planner-run', {
  height: 596,
  title: 'The planner run, decision by decision',
  desc: 'The planner reads three cards and maps skills to agents. Lane one: SendMessage for run-tests on commit a41d7c3 returns task 954267b7 completed, and summary.json shows 13 passed and 0 failed. Lane two: SendMessage for review-diff returns TASK_STATE_INPUT_REQUIRED asking for the base branch, the planner answers main on the same task, the task completes, and review.json holds one low-severity finding. Lane three: SendMessage with a bearer token for deploy returns TASK_STATE_AUTH_REQUIRED, the planner subscribes, an operator approves outside A2A on the first frame, and the stream ends at TASK_STATE_COMPLETED. The planner decides after each lane and would stop on a failed test or a high-severity finding.',
}, f => {
  f.kicker(20, 18, 'discover: one card per port, skills mapped to agents');
  f.kicker(20, 466, 'decisions');
  f.box({ x: 20, y: 540, w: 600, h: 44, hue: 'rose', dash: 'dashed', title: 'stop', sub: 'if the test task does not complete, a test fails, or a finding is high severity', titleSize: 12 });

  f.beat(1);
  const cards = [
    f.box({ x: XS[0], y: 26, w: W, h: 46, hue: 'blue', title: 'test-runner', sub: 'run-tests', titleSize: 12 }),
    f.box({ x: XS[1], y: 26, w: W, h: 46, hue: 'blue', title: 'code-reviewer', sub: 'review-diff, answer-question', titleSize: 12 }),
    f.box({ x: XS[2], y: 26, w: W, h: 46, hue: 'blue', title: 'deployer', sub: 'deploy, needs a bearer token', titleSize: 12 }),
  ];

  const tests = lane(f, 0, cards[0], [
    { beat: 2, hue: 'violet', title: 'SendMessage', sub: 'commit a41d7c3', label: 'delegate run-tests' },
    { beat: 3, hue: 'amber', double: true, title: 'TASK_STATE_COMPLETED', titleSize: 11.5, sub: 'task 954267b7', arrow: 'reply' },
    { beat: 3, hue: 'green', title: 'summary.json', sub: 'passed 13, failed 0', arrow: 'reply' },
  ]);
  decision(f, 0, 4, tests, 'tests', '13 passed, go on');

  const review = lane(f, 1, cards[1], [
    { beat: 5, hue: 'violet', title: 'SendMessage', sub: 'refunds.diff as a raw part', label: 'delegate review-diff' },
    { beat: 6, hue: 'amber', dash: 'dashed', title: 'TASK_STATE_INPUT_REQUIRED', titleSize: 11.5, sub: 'which base branch?', arrow: 'reply' },
    { beat: 7, hue: 'violet', title: 'SendMessage, same task', titleSize: 11.5, sub: 'answer from context: main', arrow: 'call', label: 'answer' },
    { beat: 8, hue: 'amber', double: true, title: 'TASK_STATE_COMPLETED', titleSize: 11.5, sub: 'task 80bc7784', arrow: 'reply' },
    { beat: 8, hue: 'green', title: 'review.json', sub: '1 finding, severity low', arrow: 'reply' },
  ]);
  decision(f, 1, 9, review, 'review', '1 finding, 0 blocking');

  const deploy = lane(f, 2, cards[2], [
    { beat: 10, hue: 'violet', title: 'SendMessage', sub: 'build 2026.10.06-1, token', label: 'delegate deploy' },
    { beat: 11, hue: 'amber', dash: 'dashed', title: 'TASK_STATE_AUTH_REQUIRED', titleSize: 11.5, sub: 'an operator must approve', arrow: 'reply' },
    { beat: 12, hue: 'indigo', title: 'SubscribeToTask', sub: 'frame 1: the Task snapshot', arrow: 'call', label: 'follow' },
    { beat: 13, hue: 'grey', title: 'operator approves', sub: 'POST /approve, not A2A', arrow: 'effect', label: 'on frame 1' },
    { beat: 14, hue: 'amber', double: true, title: 'TASK_STATE_COMPLETED', titleSize: 11.5, sub: 'task a31361b3, stream ends', arrow: 'event', label: '3 more frames' },
  ]);
  decision(f, 2, 15, deploy, 'deploy', 'TASK_STATE_COMPLETED');
});
