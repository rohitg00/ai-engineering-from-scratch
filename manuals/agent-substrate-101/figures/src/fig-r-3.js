'use strict';

const { figure } = require('../../../_shared/figkit.js');

const L = 20;
const M = 250;
const R = 480;
const W = 140;
const H = 62;
const ROWS = [64, 150, 236, 322];
const mid = row => ROWS[row] + H / 2;
const CODE = { style: 'state', hue: 'ink-mute', dash: 'dotted' };
const key = [
  'amber arrow: a state change that our runs show. rose arrow: a failure that our runs show.',
  'grey dotted arrow: a transition that we read in the code and did not run.',
  'dashed border: a state that a workflow passes through. double border: the record is removed next.',
  'A request to a CRASHED actor returns 503 with the body: AssignWorker prerequisite not met.',
  'ResumeActor on a CRASHED actor returns FailedPrecondition.',
  'SuspendActor on a SUSPENDED actor changes nothing.',
];

module.exports = figure('fig-r-3', {
  height: 596,
  title: 'The seven actor states, every transition, and what a request returns in each state',
  desc: 'A reference state figure with the enum number of each state. CreateActor makes an actor in 4 SUSPENDED. ResumeActor moves it through 1 RESUMING to 2 RUNNING, and SuspendActor moves it through 3 SUSPENDING back to SUSPENDED. A failed resume, a lost sandbox, or a failed suspend moves it to 5 CRASHED, where a request returns 503. RevertActor moves a crashed, running, or suspended actor through 7 REVERTING to SUSPENDED. DeleteActor moves an actor in every state to 6 DELETING. Each box says what a request returned in our runs.',
}, f => {
  f.rect(L, ROWS[0], W, ROWS[3] + H - ROWS[0], { hue: 'amber' });
  f.text(L + W / 2, 250, '4 SUSPENDED', { size: 12, weight: 700, anchor: 'middle' });
  f.text(L + W / 2, 267, 'holds no worker', { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });
  f.text(L + W / 2, 282, 'request: 200 in 0.36 s', { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });
  f.text(L + W / 2, 297, 'after a resume', { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });

  f.rect(R, ROWS[0], W, ROWS[2] + H - ROWS[0], { hue: 'amber' });
  f.text(R + W / 2, 122, '2 RUNNING', { size: 12, weight: 700, anchor: 'middle' });
  f.text(R + W / 2, 139, 'holds a worker', { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });
  f.text(R + W / 2, 154, 'request: 200 in', { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });
  f.text(R + W / 2, 169, '0.06 to 0.09 s', { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });
  f.text(R + W / 2, 214, 'the process exits:', { size: 11, serif: true, hue: 'rose', anchor: 'middle' });
  f.text(R + W / 2, 229, 'still RUNNING,', { size: 11, serif: true, hue: 'rose', anchor: 'middle' });
  f.text(R + W / 2, 244, 'request: 503', { size: 11, serif: true, hue: 'rose', anchor: 'middle' });

  const state = (row, title, sub, extra = {}) => f.box({ x: M, y: ROWS[row], w: W, h: H, hue: 'amber', title, titleSize: 12, sub, pad: 4, dash: 'dashed', ...extra });
  state(0, '3 SUSPENDING', ['writes a checkpoint', 'request: not recorded']);
  state(1, '1 RESUMING', ['restores the sandbox', 'request: not recorded']);
  state(2, '5 CRASHED', ['until RevertActor', 'request: 503 in 0.06 s'], { hue: 'rose', dash: undefined, strokeWidth: 2 });
  state(3, '7 REVERTING', ['last durable snapshot', 'request: not recorded']);

  f.line(90, 22, 90, ROWS[0] - 1, {});
  f.text(98, 40, 'CreateActor', { size: 11 });

  f.arrow([R, mid(0)], [M + W + 1, mid(0)], { style: 'state', label: 'SuspendActor', labelSize: 11 });
  f.arrow([M, mid(0)], [L + W + 1, mid(0)], { style: 'state', label: 'checkpoint', labelSize: 11, note: 'node or bucket' });
  f.arrow([L + W, mid(1)], [M - 1, mid(1)], { style: 'state', label: 'ResumeActor', labelSize: 11, note: 'each request' });
  f.arrow([M + W, mid(1)], [R - 1, mid(1)], { style: 'state' });
  f.text(R - 6, mid(1) + 15, 'ready', { size: 11, serif: true, hue: 'ink-soft', anchor: 'end' });

  f.path(`M${M + W} ${ROWS[0] + 54} H435 V${ROWS[2] + 12} H${M + W + 1}`, CODE);
  f.text(429, ROWS[1] - 7, 'suspend failed', { size: 11, serif: true, hue: 'ink-soft', anchor: 'end' });

  f.arrow([320, ROWS[1] + H], [320, ROWS[2] - 1], { style: 'fail', label: 'resume failed', labelSize: 11 });
  f.arrow([R, mid(2) + 10], [M + W + 1, mid(2) + 10], { style: 'fail', label: 'sandbox lost', labelSize: 11, note: 'pod, OOM, node' });
  f.arrow([320, ROWS[2] + H], [320, ROWS[3] - 1], { style: 'state', label: 'RevertActor', labelSize: 11 });

  f.arrow([M, ROWS[3] + 18], [L + W + 1, ROWS[3] + 18], { style: 'state', label: 'reverted', labelSize: 11 });
  f.arrow([L + W, ROWS[3] + 46], [M - 1, ROWS[3] + 46], { ...CODE, label: 'RevertActor', labelSize: 11 });
  f.path(`M550 ${ROWS[2] + H} V${mid(3)} H${M + W + 1}`, CODE);
  f.text(470, mid(3) - 6, 'RevertActor', { size: 11, hue: 'ink-mute', anchor: 'middle' });

  const dy = 414;
  f.box({ x: M, y: dy, w: W, h: 50, hue: 'amber', title: '6 DELETING', titleSize: 12, sub: ['stops the workload'], pad: 4, double: true });
  f.text(L, dy + 29, 'DeleteActor, in every state', { size: 11 });
  f.arrow([206, dy + 25], [M - 1, dy + 25], {});
  f.arrow([M + W, dy + 25], [440, dy + 25], { style: 'state' });
  f.text(448, dy + 29, 'the record is removed', { size: 11, serif: true, hue: 'ink-soft' });

  key.forEach((line, index) => f.text(L, 494 + index * 17, line, { size: 11, serif: true, hue: 'ink-soft' }));
});
