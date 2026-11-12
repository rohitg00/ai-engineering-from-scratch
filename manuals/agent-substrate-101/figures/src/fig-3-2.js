'use strict';

const { figure } = require('../../../_shared/figkit.js');

const W = 180;
const H = 40;

module.exports = figure('fig-3-2', {
  height: 356,
  title: 'The seven actor states and the transitions between them',
  desc: 'A state figure with the seven states of the ActorState enum at v1.0.0. CreateActor makes an actor in ACTOR_STATE_SUSPENDED. ResumeActor moves it through ACTOR_STATE_RESUMING to ACTOR_STATE_RUNNING. SuspendActor moves it through ACTOR_STATE_SUSPENDING and returns it to ACTOR_STATE_SUSPENDED. A failed restore, a lost worker pod, a memory kill or a failed suspend moves it to ACTOR_STATE_CRASHED. RevertActor moves it through ACTOR_STATE_REVERTING to ACTOR_STATE_SUSPENDED. DeleteActor moves an actor in every state to ACTOR_STATE_DELETING. Dotted grey arrows are transitions we read in the code and did not run.',
}, f => {
  const state = (x, y, name, hue = 'amber', extra = {}) => f.box({ x, y, w: W, h: H, hue, titleSize: 11.5, title: `ACTOR_STATE_${name}`, ...extra });
  const suspended = state(20, 44, 'SUSPENDED');
  const resuming = state(230, 44, 'RESUMING');
  const running = state(440, 44, 'RUNNING');
  const reverting = state(20, 144, 'REVERTING');
  const crashed = state(230, 144, 'CRASHED', 'rose');
  const suspending = state(440, 144, 'SUSPENDING');
  const deleting = state(440, 240, 'DELETING', 'grey', { double: true });

  const label = (x, y, content, anchor = 'start') => f.text(x, y, content, { size: 11, serif: true, hue: 'ink-soft', anchor });

  label(110, 16, 'CreateActor', 'middle');
  f.arrow([110, 22], [110, 43], { style: 'call' });

  f.arrow(suspended.right(), [resuming.x - 1, suspended.cy], { style: 'state' });
  label(215, 36, 'ResumeActor', 'middle');
  f.arrow(resuming.right(), [running.x - 1, resuming.cy], { style: 'state' });
  label(425, 36, 'restored and ready', 'middle');

  f.arrow([590, 84], [590, 143], { style: 'state' });
  label(582, 128, 'SuspendActor', 'end');
  f.path('M530 184 V214 H10 V64 H19', { style: 'state' });
  label(40, 208, 'snapshot on the node');

  f.arrow([290, 84], [290, 143], { style: 'fail' });
  label(282, 118, 'restore failed', 'end');
  f.path('M470 84 V114 H380 V143', { style: 'fail' });
  label(478, 104, 'worker pod gone');
  f.arrow(suspending.left(), [crashed.x + W + 1, suspending.cy], { style: 'fail' });
  label(425, 198, 'suspend failed', 'middle');

  f.arrow(crashed.left(), [reverting.x + W + 1, crashed.cy], { style: 'state' });
  label(215, 138, 'RevertActor', 'middle');
  f.arrow([60, 144], [60, 85], { style: 'state' });
  label(68, 118, 'durable snapshot');
  f.arrow([170, 84], [170, 143], { hue: 'ink-mute', dash: 'dotted' });

  label(400, 264, 'DeleteActor, accepted in every state', 'end');
  f.arrow([406, 260], [deleting.x - 1, 260], { style: 'call' });

  f.path('M20 292 H44', { style: 'state', head: false });
  f.path('M52 292 H76', { style: 'fail', head: false });
  label(84, 296, 'seen in our traces: amber is a state change, rose is a failure');
  f.path('M20 312 H76', { hue: 'ink-mute', dash: 'dotted', head: false });
  label(84, 316, 'read in the code, not run: RevertActor on a SUSPENDED actor');
  label(84, 334, 'Not drawn, also code only: RevertActor on a RUNNING actor.');
  label(84, 350, 'A process that exits leaves the actor RUNNING. Section 3.5 has that case.');
});
