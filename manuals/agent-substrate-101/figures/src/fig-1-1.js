'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-1-1', {
  height: 388,
  title: 'What Substrate does and what it leaves to you',
  desc: 'Three worker pods of the WorkerPool counter sit in a row. The middle pod, counter-7cc7dcd596-ffxwt, runs the actor my-counter-1, and the other two run no actor. Below them the object store holds one snapshot for each suspended actor, and ate-api-server with Postgres holds the state of every actor. A request resumes an actor from its snapshot onto a worker, and SuspendActor writes a snapshot and frees the worker. Two lists at the bottom divide the work: Substrate resumes on request, takes the snapshot, and routes each request, and you call SuspendActor, change the number of workers, and keep GPU work elsewhere.',
}, f => {
  f.kicker(20, 18, 'WorkerPool counter · 3 worker pods, each can run 1 actor of this size');
  const pods = [
    f.box({ x: 20, y: 28, w: 190, h: 46, hue: 'violet', title: 'counter-7cc7dcd596-5tj9h', sub: 'no actor', titleSize: 11, dash: 'dashed' }),
    f.box({ x: 225, y: 28, w: 190, h: 46, hue: 'violet', title: 'counter-7cc7dcd596-ffxwt', sub: 'CPU 1000 of 1000 millicores', titleSize: 11 }),
    f.box({ x: 430, y: 28, w: 190, h: 46, hue: 'violet', title: 'counter-7cc7dcd596-p6g2q', sub: 'no actor', titleSize: 11, dash: 'dashed' }),
  ];
  const actor = f.box({ x: 245, y: 96, w: 150, h: 40, hue: 'green', title: 'my-counter-1', sub: 'ACTOR_STATE_RUNNING', titleSize: 12 });
  f.rule(actor.cx, 74, actor.cx, 96, { hue: 'green' });
  const store = f.box({ x: 20, y: 176, w: 270, h: 46, hue: 'teal', title: 'object store', sub: 'one snapshot for each suspended actor' });
  const api = f.box({ x: 350, y: 176, w: 270, h: 46, hue: 'blue', title: 'ate-api-server and Postgres', sub: 'the state of every actor and worker' });
  f.beat(1);
  f.path(`M${store.x + 60} 176 V116 H244`, { style: 'state' });
  f.text(30, 150, 'a request resumes it', { size: 11.5, hue: 'amber', knock: true });
  f.beat(2);
  f.path(`M${actor.cx - 30} 136 V160 H${store.x + 200} V175`, { style: 'write' });
  f.text(store.x + 140, 164, 'SuspendActor', { size: 11.5, hue: 'teal', knock: true });
  f.beat(3);
  f.path(`M${api.cx} 176 V116 H396`, { style: 'call' });
  f.text(api.cx + 8, 150, 'chooses the worker', { size: 11.5, knock: true });
  f.beat(0);
  f.kicker(20, 250, 'Substrate does');
  f.kicker(336, 250, 'You do');
  f.box({ x: 20, y: 258, w: 284, h: 118, hue: 'blue', align: 'left', sub: ['resumes an actor when a request arrives', 'writes the snapshot when you suspend', 'routes each request to the right worker', 'limits what an actor can reach'], subSize: 11.5 });
  f.box({ x: 336, y: 258, w: 284, h: 118, hue: 'grey', align: 'left', sub: ['call SuspendActor: no idle timer exists', 'change spec.replicas: no autoscaler', 'run GPU work elsewhere: no device support', 'call RevertActor after a crash'], subSize: 11.5 });
  void pods;
});
