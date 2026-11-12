'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-4-3', {
  height: 352,
  title: 'How ate-api-server chooses a worker for one resume',
  desc: 'A flow from ResumeActor to a bound worker. All workers pass five filters: registered and WORKER_STATE_ACTIVE, the sandbox class of the snapshot, the node that holds a local snapshot, a runtime that can restore a memory snapshot, and the labels of the selectors. Workers with room for the limits of the actor remain. With no candidate the result is the error no worker has room for the actor. With candidates, two are sampled at random and the less loaded one is bound in one Postgres transaction.',
}, f => {
  const start = f.box({ x: 20, y: 20, w: 150, h: 48, hue: 'amber', title: 'ResumeActor', sub: 'actor is SUSPENDED' });
  f.kicker(210, 18, 'Six checks for each worker');
  const filters = [
    ['registered and WORKER_STATE_ACTIVE', 'blue'],
    ['sandbox class of the snapshot', 'violet'],
    ['node of a local snapshot, if one exists', 'teal'],
    ['runtime that can restore the memory', 'violet'],
    ['labels: workerSelector of template and actor', 'grey'],
    ['room for the limits of the actor', 'violet'],
  ];
  filters.forEach(([title, hue], index) => {
    f.box({ x: 210, y: 28 + index * 34, w: 410, h: 28, hue, title, titleSize: 12, weight: 400, align: 'left' });
  });
  f.arrow(start.right(), [209, start.cy], { style: 'call' });

  const none = f.box({ x: 20, y: 262, w: 230, h: 66, hue: 'rose', dash: 'dashed', title: 'no candidate', sub: ['no worker has room for the actor', 'the router parks the request'] });
  const pick = f.box({ x: 280, y: 262, w: 160, h: 66, hue: 'blue', title: 'two at random', sub: ['the less loaded', 'candidate wins'] });
  const bind = f.box({ x: 470, y: 262, w: 150, h: 66, hue: 'teal', title: 'bind', sub: ['one transaction', 'in Postgres'] });
  f.path(`M300 227 V246 H${none.cx} V${none.y - 1}`, { style: 'fail' });
  f.arrow([pick.cx, 227], [pick.cx, pick.y - 1], { style: 'call' });
  f.arrow(pick.right(), [bind.x - 1, pick.cy], { style: 'write' });
  f.text(bind.cx, 346, 'ACTOR_STATE_RESUMING', { size: 11, hue: 'amber', anchor: 'middle' });
});
