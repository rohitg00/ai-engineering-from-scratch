'use strict';

const { figure } = require('../../../_shared/figkit.js');

const key = [
  '1  ate-api-server creates a temporary golden actor from the template and resumes it.',
  '2  It suspends that actor at preferredFidelity and copies the snapshot to a published tag.',
  '3  It deletes the golden actor. In our run the tag was listed 21 s after the template.',
  '4  A new actor records the tag snapshot as generation 1 and starts SUSPENDED.',
  '5  The first request restores the tag snapshot on a worker: 0.62 s at 200 MiB.',
];

module.exports = figure('fig-3-1', {
  height: 318,
  title: 'From ActorTemplate to the first call of a new actor',
  desc: 'Two rows. The top row happens once per template: the template lab-c/ballast-200 leads to a temporary golden actor, which is suspended and copied to a golden tag. The bottom row happens for each new actor: kubectl ate create actor b200-1 makes an actor in ACTOR_STATE_SUSPENDED that points at the tag snapshot, and the first request restores it to ACTOR_STATE_RUNNING in 0.62 s at 200 MiB.',
}, f => {
  f.kicker(20, 18, 'Once for each template');
  const tmpl = f.box({ x: 20, y: 28, w: 150, h: 52, hue: 'green', title: 'ActorTemplate', sub: 'lab-c/ballast-200' });
  const golden = f.box({ x: 215, y: 28, w: 180, h: 52, hue: 'green', dash: 'dashed', title: 'golden actor', sub: 'temporary, same atespace' });
  const tag = f.box({ x: 440, y: 28, w: 180, h: 52, hue: 'teal', title: 'golden tag', sub: 'SNAPSHOT_OWNER_TAG' });
  f.arrow(tmpl.right(), [golden.x - 1, tmpl.cy], { style: 'call' });
  f.arrow(golden.right(), [tag.x - 1, golden.cy], { style: 'write' });
  f.step(192, 40, 1);
  f.step(417, 40, 2);
  f.step(305, 96, 3);

  f.kicker(20, 128, 'For each new actor');
  const create = f.box({ x: 20, y: 138, w: 150, h: 52, hue: 'olive', title: 'create actor', sub: 'kubectl ate, b200-1' });
  const suspended = f.box({ x: 215, y: 138, w: 180, h: 52, hue: 'amber', titleSize: 11.5, title: 'ACTOR_STATE_SUSPENDED', sub: 'gen 1 is the tag snapshot' });
  const running = f.box({ x: 440, y: 138, w: 180, h: 52, hue: 'amber', titleSize: 11.5, title: 'ACTOR_STATE_RUNNING', sub: 'count=1 in the reply' });
  f.arrow(create.right(), [suspended.x - 1, create.cy], { style: 'call' });
  f.arrow(suspended.right(), [running.x - 1, suspended.cy], { style: 'state' });
  f.step(192, 150, 4);
  f.step(417, 150, 5);
  f.arrow([500, 80], [500, 137], { style: 'reply', label: 'restore reads it' });

  key.forEach((line, index) => f.text(20, 222 + index * 18, line, { size: 11, serif: true, hue: 'ink-soft' }));
});
