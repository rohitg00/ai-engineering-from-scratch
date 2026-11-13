'use strict';

const fs = require('fs');
const path = require('path');
const { figure } = require('../../../_shared/figkit.js');

const read = rel => fs.readFileSync(path.join(__dirname, '../../capture/lab', rel), 'utf8').trim().split('\n').map(line => line.split('\t'));
const trace = read('B-lifecycle/10-trace.tsv');
const ops = read('B-lifecycle/20-trace-ops.tsv');
const first = Number(trace.find(row => row[1] === 'call-1')[3]);
const suspend = Number(ops.find(row => row[1] === 'suspend-async')[2].replace('s', ''));
const samples = trace.filter(row => row[1] === 'state').length - 3;
const idle = trace.find(row => row[1] === 'idle-watch-start')[2].replace('no requests for ', '');
const s2 = value => `${(Math.round(value * 100) / 100).toFixed(2)} s`;

module.exports = figure('fig-1-1', {
  height: 384,
  title: 'What Substrate does and what it leaves to you',
  desc: `Three worker pods of the WorkerPool counter sit in a row. The middle pod, counter-7cc7dcd596-ffxwt, runs the actor my-counter-1, and the other two run no actor. Below them the object store holds one snapshot for each suspended actor, and ate-api-server with Postgres holds the state of every actor. A dashed amber arrow from the object store to the actor says that a request resumes the actor, which Substrate does, in ${s2(first)} in our run. A thick teal arrow from the actor to the object store is SuspendActor, which you must call: after ${idle} with no request the actor was RUNNING in ${samples} of ${samples} samples. Two lists at the bottom divide the work. Substrate resumes on a request, writes the snapshot at a suspend, routes each request, and limits what an actor can reach. You call SuspendActor, change the number of workers, call RevertActor after a crash, and run GPU work elsewhere.`,
}, f => {
  f.kicker(20, 18, 'WorkerPool counter · 3 worker pods, each has room for 1 actor of this size');
  const pod = (x, name, sub, dash) => f.box({ x, y: 28, w: 190, h: 44, hue: 'violet', title: name, sub, titleSize: 11, dash });
  pod(20, 'counter-7cc7dcd596-5tj9h', 'no actor', 'dashed');
  const host = pod(225, 'counter-7cc7dcd596-ffxwt', 'CPU 1000 of 1000 millicores');
  pod(430, 'counter-7cc7dcd596-p6g2q', 'no actor', 'dashed');
  const actor = f.box({ x: 235, y: 92, w: 170, h: 44, hue: 'green', title: 'my-counter-1', sub: 'ACTOR_STATE_RUNNING', titleSize: 12.5, strokeWidth: 1.6 });
  f.rule(host.cx, 72, host.cx, 92, { hue: 'green', width: 1.6 });
  const store = f.box({ x: 20, y: 192, w: 300, h: 46, hue: 'teal', title: 'object store', sub: 'one snapshot for each suspended actor' });
  const api = f.box({ x: 350, y: 192, w: 270, h: 46, hue: 'blue', title: 'ate-api-server and Postgres', sub: 'the state of every actor and worker' });

  f.beat(1);
  f.path(`M60 ${store.y} V114 H${actor.x - 1}`, { style: 'state' });
  f.text(72, 108, 'a request resumes it', { size: 11.5, hue: 'amber' });
  f.text(72, 132, `Substrate does this: ${s2(first)}`, { size: 11, serif: true, hue: 'ink-soft' });
  f.beat(2);
  f.path(`M290 ${actor.y + actor.h} V${store.y - 1}`, { style: 'write', width: 2.4 });
  f.text(300, 160, 'SuspendActor', { size: 11.5, hue: 'teal', weight: 700 });
  f.text(300, 176, 'you must call it', { size: 11, serif: true, hue: 'ink-soft' });
  f.beat(3);
  f.path(`M${api.cx + 40} ${api.y} V114 H${actor.x + actor.w + 1}`, { style: 'call' });
  f.text(api.cx + 48, 160, 'chooses', { size: 11.5 });
  f.text(api.cx + 48, 176, 'the worker', { size: 11.5 });

  f.beat(0);
  f.kicker(20, 268, 'Substrate does');
  f.kicker(328, 268, 'You do');
  f.box({ x: 20, y: 276, w: 292, h: 96, hue: 'blue', align: 'left', subSize: 11.5, sub: [
    `resumes an actor on a request: ${s2(first)}`,
    `writes the snapshot at a suspend: ${s2(suspend)}`,
    'routes each request to the right worker',
    'limits what an actor can reach',
  ] });
  f.box({ x: 328, y: 276, w: 292, h: 96, hue: 'grey', align: 'left', subSize: 11.5, sub: [
    `call SuspendActor: RUNNING after ${idle} idle`,
    'change spec.replicas: no autoscaler',
    'call RevertActor after a crash',
    'run GPU work elsewhere: no device support',
  ] });
});
