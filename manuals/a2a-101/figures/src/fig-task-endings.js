'use strict';

const { figure } = require('../../../_shared/figkit.js');

const cards = [
  {
    x: 20, y: 28, state: 'TASK_STATE_COMPLETED', where: 'test-runner, task 3d8f7801',
    by: 'chosen by the agent: the suite ran', byHue: 'blue',
    message: ['1 failed, 11 passed'],
    artifacts: 'artifacts: test-log.txt, summary.json',
  },
  {
    x: 330, y: 28, state: 'TASK_STATE_FAILED', where: 'test-runner, task 8ae21dcb',
    by: 'chosen by the agent: no such commit', byHue: 'blue',
    message: ['Commit deadbee does not exist in', 'payments-api.'],
    artifacts: 'artifacts: none',
  },
  {
    x: 20, y: 206, state: 'TASK_STATE_CANCELED', where: 'test-runner, task f22ed7af',
    by: 'chosen by the client: CancelTask', byHue: 'violet',
    message: ["Canceled at the client's request."],
    artifacts: 'artifacts: test-log.txt, two chunks',
  },
  {
    x: 330, y: 206, state: 'TASK_STATE_REJECTED', where: 'deployer, task 23cf3710',
    by: 'chosen by the agent: its policy', byHue: 'blue',
    message: ["Production deploys are outside this agent's", 'policy. Use the release train.'],
    artifacts: 'artifacts: none',
  },
];

const after = [
  { y: 410, call: 'SendMessage, taskId f22ed7af', error: 'UnsupportedOperationError, -32004' },
  { y: 452, call: 'CancelTask, a second time', error: 'TaskNotCancelableError, -32002' },
];

module.exports = figure('fig-task-endings', {
  height: 492,
  title: 'Four ways a task ends',
  desc: 'Four cards, one per terminal state from the kit. Completed: test-runner task 3d8f7801, chosen by the agent because the suite ran, status message 1 failed, 11 passed, with test-log.txt and summary.json. Failed: task 8ae21dcb, chosen by the agent because commit deadbee does not exist, no artifacts. Canceled: task f22ed7af, chosen by the client with CancelTask, two log chunks kept. Rejected: deployer task 23cf3710, refused by policy, no artifacts. Below, a message to the canceled task gets UnsupportedOperationError and a second cancel gets TaskNotCancelableError.',
}, f => {
  f.kicker(20, 16, 'Four terminal states from the kit');
  cards.forEach((card, index) => {
    f.beat(index + 1);
    f.box({ x: card.x, y: card.y, w: 290, h: 42, hue: 'amber', double: true, title: card.state, sub: card.where });
    f.text(card.x + 4, card.y + 60, card.by, { size: 11.5, hue: card.byHue });
    f.box({ x: card.x, y: card.y + 70, w: 290, h: 62, hue: 'blue', title: 'status message', titleSize: 11, sub: card.message, align: 'left' });
    f.text(card.x + 4, card.y + 152, card.artifacts, { size: 11.5, hue: 'green' });
  });
  f.beat(5);
  f.rule(20, 384, 620, 384, { hue: 'ink-mute', dash: 'dashed' });
  f.kicker(20, 400, 'After the end');
  f.text(140, 400, 'calls to the canceled task f22ed7af, from 10-cancel.http', { size: 11, serif: true, hue: 'ink-soft' });
  after.forEach((row, index) => {
    f.beat(5 + index);
    f.box({ x: 20, y: row.y, w: 250, h: 30, hue: 'violet', title: row.call, titleSize: 11.5 });
    f.arrow([270, row.y + 15], [329, row.y + 15], { style: 'fail' });
    f.box({ x: 330, y: row.y, w: 290, h: 30, hue: 'rose', title: row.error, titleSize: 11.5 });
  });
});
