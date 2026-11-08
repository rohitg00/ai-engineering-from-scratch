'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

const messages = [
  { kicker: 'Call 1 · review a diff', y: 168, hue: 'violet', title: 'ROLE_USER · 14a03569', sub: 'text and raw refunds.diff, no ids sent' },
  { y: 212, hue: 'blue', title: 'ROLE_AGENT · 46494a30', sub: 'asks which base branch to use' },
  { kicker: 'Call 2 · answer the question', y: 274, hue: 'violet', title: 'ROLE_USER · 096d3737 · main', sub: 'taskId e5c95b09, contextId 49c5a238' },
  { y: 318, hue: 'blue', title: 'ROLE_AGENT · 8f9ee658', sub: 'Comparing the diff against main' },
];

module.exports = figure('fig-context-and-tasks', {
  height: 452,
  title: 'One context, two tasks',
  desc: 'A tree. The root is context 49c5a238. Its first child is the review task e5c95b09, completed, whose history holds four messages from two SendMessage calls: the planner request with the diff and the agent question, then the planner answer main carrying taskId and contextId and the agent reply, followed by the artifact review.json. Its second child, drawn dashed because the captures stop before it, is a follow-up task in the same context whose first message carries contextId 49c5a238 and referenceTaskIds naming e5c95b09 and no taskId.',
}, f => {
  f.rect(190, 12, 260, 46, { fill: color('paper'), stroke: color('ink-mute') });
  f.text(320, 31, 'context 49c5a238', { size: 12.5, weight: 700, anchor: 'middle' });
  f.text(320, 48, 'created by code-reviewer, opaque to you', { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });
  f.path('M320 58 V78 H170 V96', { style: 'call', hue: 'ink-mute', head: false });
  const review = f.box({ x: 20, y: 96, w: 300, h: 50, hue: 'amber', double: true, title: 'task e5c95b09 · review', sub: 'TASK_STATE_COMPLETED, status: 2 findings' });
  f.path(`M36 ${review.y + review.h} V399`, { style: 'call', hue: 'ink-mute', head: false });
  f.text(20, 444, 'Violet: sent by the planner. Blue: sent by code-reviewer. Ids shortened to 8 characters.', { size: 11, serif: true, hue: 'ink-soft' });

  messages.forEach((message, index) => {
    f.beat(index + 1);
    if (message.kicker) f.kicker(56, message.y - 8, message.kicker);
    f.box({ x: 56, y: message.y, w: 264, h: 38, hue: message.hue, title: message.title, titleSize: 12, sub: message.sub });
    f.path(`M36 ${message.y + 19} H55`, { style: 'call', hue: 'ink-mute', head: false });
  });

  f.beat(5);
  f.kicker(56, 374, 'Result');
  f.box({ x: 56, y: 380, w: 264, h: 38, hue: 'green', title: 'artifact review.json', titleSize: 12, sub: 'a text part and a data part' });
  f.path('M36 399 H55', { style: 'call', hue: 'ink-mute', head: false });

  f.beat(6);
  f.path('M320 78 H596 V96', { style: 'call', hue: 'ink-mute', dash: 'dashed', head: false });
  const follow = f.box({ x: 360, y: 96, w: 260, h: 50, hue: 'grey', dash: 'dashed', title: 'a follow-up task', sub: 'id created by the server' });

  f.beat(7);
  f.kicker(376, 168, 'Its first message');
  f.path(`M596 ${follow.y + follow.h} V175`, { style: 'call', hue: 'ink-mute', dash: 'dashed', head: false });
  const first = f.box({ x: 376, y: 176, w: 244, h: 66, hue: 'violet', dash: 'dashed', title: 'ROLE_USER · a new messageId', titleSize: 12, sub: ['contextId 49c5a238', 'referenceTaskIds [e5c95b09]', 'no taskId'] });
  f.path(`M${first.x} ${first.y + 20} H340 V${review.cy} H${review.x + review.w + 1}`, { style: 'call', hue: 'violet' });
  f.text(376, 268, 'A message with taskId e5c95b09 now', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(376, 284, 'fails: the task is terminal.', { size: 11, serif: true, hue: 'ink-soft' });
});
