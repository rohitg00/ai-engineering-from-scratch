'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const turns = load(path.join(__dirname, '../../capture/lab/summary/kagent-turns-x86.json'));
const resume = turns.resume_seconds.turns_only;
const suspend = turns.suspend_seconds;
const dwell = stat => `${stat.median.toFixed(2)} s median of ${stat.n}`;

const W = 150;
const H = 50;
const COL = [14, 245, 476];
const TOP = 44;
const LOW = 176;

module.exports = figure('fig-3-2', {
  height: 366,
  title: 'The seven actor states and the transitions between them',
  desc: `A state figure with the seven states of the ActorState enum at v1.0.0. CreateActor makes an actor in ACTOR_STATE_SUSPENDED. ResumeActor moves it through ACTOR_STATE_RESUMING to ACTOR_STATE_RUNNING. SuspendActor moves it through ACTOR_STATE_SUSPENDING and returns it to ACTOR_STATE_SUSPENDED. A failed restore, a lost worker pod, a memory kill or a failed suspend moves it to ACTOR_STATE_CRASHED, where a request gets 503. The only arrow that leaves ACTOR_STATE_CRASHED is RevertActor, which moves the actor through ACTOR_STATE_REVERTING to ACTOR_STATE_SUSPENDED. DeleteActor moves an actor in every state to ACTOR_STATE_DELETING. On the kagent guest an actor spent a median of ${resume.median.toFixed(2)} s in ACTOR_STATE_RESUMING over ${resume.n} turns and ${suspend.median.toFixed(2)} s in ACTOR_STATE_SUSPENDING over ${suspend.n} suspends. A dotted grey arrow is a transition we read in the code and did not run.`,
}, f => {
  const state = (col, y, name, sub, hue = 'amber', extra = {}) => f.box({ x: COL[col], y, w: W, h: H, hue, titleSize: 11, pad: 2, title: `ACTOR_STATE_${name}`, sub, ...extra });
  const suspended = state(0, TOP, 'SUSPENDED', 'no sandbox, no worker');
  const resuming = state(1, TOP, 'RESUMING', dwell(resume));
  const running = state(2, TOP, 'RUNNING', 'a sandbox on a worker');
  const reverting = state(0, LOW, 'REVERTING', 'later calls are lost');
  const crashed = state(1, LOW, 'CRASHED', 'a request gets 503', 'rose', { strokeWidth: 2 });
  const suspending = state(2, LOW, 'SUSPENDING', dwell(suspend));

  const label = (x, y, content, options = {}) => f.text(x, y, content, { size: 11, serif: true, hue: options.hue || 'ink-soft', anchor: options.anchor, weight: options.weight });
  const gap = (a, b) => (a.x + W + b.x) / 2;

  label(89, 16, 'CreateActor', { anchor: 'middle' });
  f.arrow([89, 22], [89, TOP - 1], { style: 'call' });

  f.arrow(suspended.right(), [resuming.x - 1, suspended.cy], { style: 'state' });
  label(gap(suspended, resuming), suspended.cy - 8, 'ResumeActor', { anchor: 'middle' });
  f.arrow(resuming.right(), [running.x - 1, resuming.cy], { style: 'state' });
  label(gap(resuming, running), resuming.cy - 8, 'restored', { anchor: 'middle' });

  f.arrow([596, TOP + H], [596, LOW - 1], { style: 'state' });
  label(588, 154, 'SuspendActor', { anchor: 'end' });
  f.path(`M554 ${LOW + H} V250 H5 V${suspended.cy} H13`, { style: 'state' });
  label(300, 244, 'the snapshot is on the node');

  f.arrow([293, TOP + H], [293, LOW - 1], { style: 'fail' });
  label(285, 154, 'restore failed', { anchor: 'end', hue: 'rose' });
  f.path(`M512 ${TOP + H} V124 H363 V${LOW - 1}`, { style: 'fail' });
  label(504, 118, 'worker pod gone, memory kill', { anchor: 'end', hue: 'rose' });
  f.arrow(suspending.left(), [crashed.x + W + 1, suspending.cy], { style: 'fail' });
  label(gap(crashed, suspending), suspending.cy - 8, 'suspend', { anchor: 'middle', hue: 'rose' });
  label(gap(crashed, suspending), suspending.cy + 16, 'failed', { anchor: 'middle', hue: 'rose' });

  f.arrow(crashed.left(), [reverting.x + W + 1, crashed.cy], { style: 'state', width: 2 });
  label(gap(reverting, crashed), crashed.cy - 8, 'RevertActor', { anchor: 'middle', hue: 'ink', weight: 700 });
  label(gap(reverting, crashed), crashed.cy + 16, 'the only', { anchor: 'middle' });
  label(gap(reverting, crashed), crashed.cy + 30, 'way out', { anchor: 'middle' });
  f.arrow([70, LOW], [70, TOP + H + 1], { style: 'state' });
  label(78, 138, 'last durable snapshot');
  f.arrow([34, TOP + H], [34, LOW - 1], { hue: 'ink-mute', dash: 'dotted' });

  const deleting = f.box({ x: COL[2], y: 298, w: W, h: H, hue: 'grey', titleSize: 11, pad: 2, title: 'ACTOR_STATE_DELETING', sub: 'then the actor is gone', double: true });
  label(deleting.cx, 278, 'DeleteActor, from every state', { anchor: 'middle' });
  f.arrow([deleting.cx, 283], [deleting.cx, 297], { style: 'call' });

  f.path('M14 286 H40', { style: 'state', head: false });
  f.path('M48 286 H76', { style: 'fail', head: false });
  label(84, 290, 'in our traces: amber is a state change, rose is a failure');
  f.path('M14 304 H76', { hue: 'ink-mute', dash: 'dotted', head: false });
  label(84, 308, 'read in the code, not run: RevertActor on a SUSPENDED actor');
  label(14, 326, 'Not drawn, also code only: RevertActor on a RUNNING actor.');
  label(14, 342, 'Times in RESUMING and SUSPENDING: kagent guest, files-only actors.');
  label(14, 358, 'A process that exits leaves the actor RUNNING. Section 3.5 has that case.');
  void running;
});
