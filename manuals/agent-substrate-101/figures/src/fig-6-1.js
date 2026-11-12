'use strict';

const fs = require('fs');
const path = require('path');
const { figure } = require('../../../_shared/figkit.js');

const lab = path.join(__dirname, '../../capture/lab/G-dataplane/envoy/ingress-auth');
const results = fs.readFileSync(path.join(lab, '51-rightid-results.txt'), 'utf8');
const seconds = Number(/23-rightid-https-443[\s\S]*?code=200 t=([0-9.]+)/.exec(results)[1]);
const log = fs.readFileSync(path.join(lab, '52-router-log-atenet-router.log'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
const request = log.find(entry => entry.msg === 'Request' && entry.host === 'atenet-router.ate-system.svc');
const trace = log.filter(entry => entry.trace_id === request.trace_id);
const stamp = entry => {
  const [, clock, fraction] = /T(\d\d:\d\d:\d\d)\.(\d+)Z/.exec(entry.time);
  const [h, m, s] = clock.split(':').map(Number);
  return (h * 3600 + m * 60 + s) * 1000 + Number(`0.${fraction}`) * 1000;
};
const asked = trace.find(entry => entry.msg === 'ResumeActor');
const answered = trace.find(entry => entry.msg === 'ResumeActor result');
const resumeMs = stamp(answered) - stamp(asked);
const state = answered.state;
const totalMs = Math.round(seconds * 1000);

const lanes = [
  { x: 74, w: 112, title: 'caller pod', sub: 'atenet-client', hue: 'olive' },
  { x: 214, w: 112, title: 'atenet-router', sub: 'Service port 443', hue: 'indigo' },
  { x: 354, w: 112, title: 'ate-api-server', sub: 'control plane', hue: 'blue' },
  { x: 474, w: 100, title: 'Postgres', sub: 'actor rows', hue: 'teal' },
  { x: 580, w: 100, title: 'worker pod', sub: 'my-counter-1', hue: 'violet' },
];

const rows = [
  [0, 1, 'call', 'POST / over mTLS', 'ate-target-actor header'],
  [1, 2, 'call', 'ResumeActor', 'for every request'],
  [2, 3, 'call', 'read actor row', null],
  [2, 1, 'reply', state, 'worker IP and SPIFFE ID'],
  [1, 4, 'event', 'mTLS CONNECT to the worker', 'then actor port 80'],
  [4, 1, 'reply', '200', null],
  [1, 0, 'reply', '200', `${totalMs} ms at the caller`],
];
const yOf = index => 84 + index * 46;

module.exports = figure('fig-6-1', {
  height: 410,
  title: 'One request through atenet-router to a running actor',
  desc: `Five lifelines: a caller pod with the identity atenet-client, atenet-router, ate-api-server, Postgres, and the worker pod that runs my-counter-1. Seven numbered exchanges: the caller sends POST over mutual TLS with the ate-target-actor header, the router calls ResumeActor, ate-api-server reads the actor row, and it returns ${state} with the worker IP and SPIFFE ID. That call took ${resumeMs.toFixed(1)} milliseconds. The router opens an mTLS CONNECT to the worker, the actor answers 200, and the caller has the 200 after ${totalMs} milliseconds.`,
}, f => {
  lanes.forEach(lane => {
    f.box({ x: lane.x, y: 8, w: lane.w, h: 40, hue: lane.hue, title: lane.title, sub: lane.sub, titleSize: 11, anchor: 'middle', pad: 3 });
    f.lifeline(lane.x, 48, 400);
  });
  const bx = lanes[1].x - 12;
  f.rule(bx, yOf(1), bx, yOf(3), { hue: 'ink', width: 1.4 });
  f.rule(bx, yOf(1), bx + 6, yOf(1), { hue: 'ink', width: 1.4 });
  f.rule(bx, yOf(3), bx + 6, yOf(3), { hue: 'ink', width: 1.4 });
  f.text(bx - 8, yOf(2) - 2, `${resumeMs.toFixed(1)} ms`, { size: 12, weight: 700, anchor: 'end' });
  f.text(bx - 8, yOf(2) + 13, `of the ${totalMs} ms`, { size: 11, serif: true, hue: 'ink-soft', anchor: 'end' });
  rows.forEach(([from, to, style, label, note], index) => {
    const y = yOf(index);
    f.beat(index + 1);
    f.step(12, y, index + 1);
    const x1 = lanes[from].x;
    const x2 = lanes[to].x;
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label, note: note || undefined });
  });
});
