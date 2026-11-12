'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-3-5', {
  height: 372,
  title: 'From the error text to the fix',
  desc: 'A decision figure with four rows. A 500 with the text error resuming actor and a 503 with the text AssignWorker prerequisite not met both mean ACTOR_STATE_CRASHED, and the fix is kubectl ate revert actor, which loses the calls since the last completed snapshot. A 503 with the text upstream connect error means the process exited while the state is still ACTOR_STATE_RUNNING, and a synchronous suspend moves it to CRASHED before the revert. A 503 after 5 seconds with the text no worker has room for the actor means the actor is healthy and the pool is full.',
}, f => {
  f.kicker(20, 18, 'What the caller sees');
  f.kicker(296, 18, 'Actor state');
  f.kicker(456, 18, 'What to do');

  const seen = (y, title, sub, hue = 'rose') => f.box({ x: 20, y, w: 250, h: 60, hue, align: 'left', title, sub });
  const a = seen(28, '500 in 0.08 s', ['error resuming actor lab-c/x1']);
  const b = seen(104, '503 in 0.06 s', ['AssignWorker prerequisite not met', 'got: ACTOR_STATE_CRASHED']);
  const c = seen(196, '503 in 0.06 s', ['upstream connect error or disconnect', 'reset reason: connection termination']);
  const d = seen(288, '503 after 5.06 s', ['no worker has room for the actor'], 'grey');

  const crashed = f.box({ x: 296, y: 50, w: 134, h: 92, hue: 'rose', title: 'CRASHED', sub: ['resume actor', 'is refused'] });
  const running = f.box({ x: 296, y: 196, w: 134, h: 60, hue: 'rose', dash: 'dashed', title: 'RUNNING', sub: ['the process exited'] });
  const suspended = f.box({ x: 296, y: 288, w: 134, h: 60, hue: 'amber', title: 'SUSPENDED', sub: ['the pool is full'] });

  const revert = f.box({ x: 456, y: 50, w: 164, h: 92, hue: 'amber', title: 'revert actor', sub: ['back to the last', 'COMPLETED snapshot,', 'later calls are lost'] });
  const suspend = f.box({ x: 456, y: 196, w: 164, h: 60, hue: 'amber', title: 'suspend --mode sync', titleSize: 11.5, sub: ['it fails and marks', 'the actor CRASHED'] });
  const wait = f.box({ x: 456, y: 288, w: 164, h: 60, hue: 'violet', title: 'add workers', sub: ['or try again later,', 'see section 4.4'] });

  f.arrow(a.right(), [crashed.x - 1, a.cy], { style: 'fail' });
  f.arrow(b.right(), [crashed.x - 1, b.cy - 12], { style: 'fail' });
  f.arrow(c.right(), [running.x - 1, c.cy], { style: 'fail' });
  f.arrow(d.right(), [suspended.x - 1, d.cy], { style: 'call' });
  f.arrow(crashed.right(), [revert.x - 1, crashed.cy], { style: 'call' });
  f.arrow(running.right(), [suspend.x - 1, running.cy], { style: 'call' });
  f.arrow(suspended.right(), [wait.x - 1, suspended.cy], { style: 'call' });
  f.arrow([538, 195], [538, 143], { style: 'state' });
  f.text(20, 366, 'Seconds and names are from our runs on the x86 server guest, Envoy dataplane.', { size: 11, serif: true, hue: 'ink-soft' });
});
