'use strict';

const fs = require('fs');
const path = require('path');
const { figure } = require('../../../_shared/figkit.js');

const trace = fs.readFileSync(path.join(__dirname, '../../capture/lab/B-lifecycle/10-trace.tsv'), 'utf8').trim().split('\n').map(line => line.split('\t'));
const first = Number(trace.find(row => row[1] === 'call-1')[3]);
const running = JSON.parse(fs.readFileSync(path.join(__dirname, '../../capture/lab/B-lifecycle/12-actor-running.json'), 'utf8'));
const workerIp = running.status.workerAssignment.workerPodIps[0];

const lanes = [
  { title: 'curl', sub: 'client', hue: 'olive' },
  { title: 'kubectl ate', sub: 'proxy actor', hue: 'olive' },
  { title: 'atenet-router', sub: 'dataplane', hue: 'indigo' },
  { title: 'ate-api-server', sub: 'control plane', hue: 'blue' },
  { title: 'Postgres', sub: 'actor rows', hue: 'teal' },
  { title: 'worker pod', sub: 'my-counter-1', hue: 'violet' },
];
const cx = index => 60 + index * 104;

const rows = [
  [0, 1, 'call', 'POST / on 127.0.0.1:8000', null],
  [1, 2, 'event', 'mTLS CONNECT to port 8444', 'through a kube-apiserver port-forward'],
  [2, 3, 'call', 'ResumeActor', 'sent for every request'],
  [3, 4, 'call', 'read the actor row', 'ACTOR_STATE_SUSPENDED'],
  [3, 4, 'write', 'take the lease, bind a worker', null],
  [3, 5, 'state', 'atelet restores the golden snapshot', 'SUSPENDED to RUNNING'],
  [3, 2, 'reply', `worker ${workerIp}`, 'with its SPIFFE ID'],
  [2, 5, 'event', 'CONNECT to port 8443', 'then actor port 80'],
  [1, 0, 'reply', '200, count: 1', `${first.toFixed(3)} s at the client`],
];

module.exports = figure('fig-1-2', {
  height: 500,
  title: 'The first request to my-counter-1',
  desc: `Six lifelines: curl, kubectl ate proxy actor, atenet-router, ate-api-server, Postgres, and the worker pod. Nine numbered exchanges: curl sends POST to 127.0.0.1:8000, the proxy opens an mTLS CONNECT to router port 8444 through a kube-apiserver port-forward, the router calls ResumeActor, ate-api-server reads the actor row and finds it suspended, takes the lease and binds a worker, has atelet restore the golden snapshot so the actor goes from SUSPENDED to RUNNING, and returns worker ${workerIp} to the router. The router opens a CONNECT to worker port 8443, and curl gets 200 with count 1 after ${first.toFixed(3)} seconds.`,
}, f => {
  lanes.forEach((lane, index) => {
    f.box({ x: cx(index), y: 8, w: 100, h: 40, hue: lane.hue, title: lane.title, sub: lane.sub, titleSize: 11, anchor: 'middle', pad: 3 });
    f.lifeline(cx(index), 48, 490);
  });
  rows.forEach(([from, to, style, label, note], index) => {
    const y = 82 + index * 46;
    f.beat(index + 1);
    f.step(16, y, index + 1);
    const x1 = cx(from);
    const x2 = cx(to);
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label, note: note || undefined });
  });
});
