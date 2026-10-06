'use strict';

const { figure } = require('../../../_shared/figkit.js');

const lanes = [
  { x: 100, title: 'planner', sub: 'client agent', hue: 'violet' },
  { x: 350, title: 'deployer', sub: 'remote agent', hue: 'blue' },
  { x: 556, title: 'operator', sub: 'outside A2A', hue: 'grey' },
];

const rows = [
  [0, 1, 'call', 'SendStreamingMessage', 'deploy 2026.10.06-1 to staging'],
  [1, 0, 'event', 'task, TASK_STATE_SUBMITTED', 'frame 1'],
  [1, 0, 'event', 'TASK_STATE_WORKING', 'frame 2: Preparing build'],
  [1, 0, 'event', 'TASK_STATE_AUTH_REQUIRED', 'frame 3: link to /approve/ecf2dcb6'],
  [2, 1, 'effect', 'POST /approve/ecf2dcb6', 'the approval, outside A2A'],
  [1, 2, 'reply', '200, approved: true', 'plain HTTP'],
  [1, 0, 'event', 'TASK_STATE_WORKING', 'frame 4: Approved by an operator'],
  [1, 0, 'event', 'artifactUpdate', 'frame 5: deploy-report.json'],
  [1, 0, 'event', 'TASK_STATE_COMPLETED', 'frame 6, then the stream closes'],
];

module.exports = figure('fig-auth-required', {
  height: 468,
  title: 'A deploy that waits for an operator',
  desc: 'A sequence with three lifelines: the planner, the deployer agent, and an operator outside A2A. The planner opens a stream with SendStreamingMessage. Frames 1 to 3 carry the task in TASK_STATE_SUBMITTED, TASK_STATE_WORKING, and TASK_STATE_AUTH_REQUIRED with an approval link. The stream stays open with no frames while the operator posts to the approval endpoint over plain HTTP. Then frames 4 to 6 carry TASK_STATE_WORKING, the deploy-report.json artifact, and TASK_STATE_COMPLETED, and the stream closes.',
}, f => {
  for (const lane of lanes) {
    f.box({ x: lane.x, y: 8, w: 150, h: 38, hue: lane.hue, title: lane.title, sub: lane.sub, anchor: 'middle' });
    f.lifeline(lane.x, 46, 456);
  }
  const rowY = index => 84 + index * 44;
  rows.forEach(([from, to, style, label, note], index) => {
    const y = rowY(index);
    f.beat(index + 1);
    f.step(24, y, index + 1);
    const x1 = lanes[from].x;
    const x2 = lanes[to].x;
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label, note, labelX: (x1 + x2) / 2 });
    if (index === 3) {
      f.rule(112, rowY(3) + 22, 112, rowY(6) - 16, { hue: 'indigo', dash: 'dotted', width: 1.6 });
      f.text(124, rowY(4) + 26, 'the stream stays open,', { size: 11, hue: 'indigo' });
      f.text(124, rowY(4) + 41, 'no frames while it waits', { size: 11, hue: 'indigo' });
    }
  });
});
