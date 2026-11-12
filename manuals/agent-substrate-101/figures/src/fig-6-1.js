'use strict';

const fs = require('fs');
const path = require('path');
const { figure } = require('../../../_shared/figkit.js');

const lab = path.join(__dirname, '../../capture/lab');
const results = fs.readFileSync(path.join(lab, 'G-dataplane/envoy/ingress-auth/51-rightid-results.txt'), 'utf8');
const seconds = Number(/23-rightid-https-443[\s\S]*?code=200 t=([0-9.]+)/.exec(results)[1]);
const routerLog = fs.readFileSync(path.join(lab, 'E-dependency-loss/15-T2-router-during.log'), 'utf8');
const state = /"msg":"ResumeActor result".*?"state":"([A-Z_]+)"/.exec(routerLog)[1];

const lanes = [
  { title: 'caller pod', sub: 'atenet-client', hue: 'olive' },
  { title: 'atenet-router', sub: 'Service port 443', hue: 'indigo' },
  { title: 'ate-api-server', sub: 'control plane', hue: 'blue' },
  { title: 'Postgres', sub: 'actor rows', hue: 'teal' },
  { title: 'worker pod', sub: 'my-counter-1', hue: 'violet' },
];
const cx = index => 76 + index * 124;

const rows = [
  [0, 1, 'call', 'POST / with a client cert', 'ate-target-actor header'],
  [1, 2, 'call', 'ResumeActor', 'for every request'],
  [2, 3, 'call', 'read the actor row', null],
  [2, 1, 'reply', state, 'worker IP and SPIFFE ID'],
  [1, 4, 'event', 'mTLS CONNECT to the worker', 'then actor port 80'],
  [4, 1, 'reply', '200', null],
  [1, 0, 'reply', '200', `${seconds.toFixed(3)} s at the caller`],
];

module.exports = figure('fig-6-1', {
  height: 410,
  title: 'One request through atenet-router to a running actor',
  desc: `Five lifelines: a caller pod with the identity atenet-client, atenet-router, ate-api-server, Postgres, and the worker pod that runs my-counter-1. Seven numbered exchanges: the caller sends POST with a client certificate and the ate-target-actor header, the router calls ResumeActor, ate-api-server reads the actor row, and it returns ${state} with the worker IP and SPIFFE ID. The router opens an mTLS CONNECT to the worker, the actor answers 200, and the caller has the 200 after ${seconds.toFixed(3)} seconds.`,
}, f => {
  lanes.forEach((lane, index) => {
    f.box({ x: cx(index), y: 8, w: 116, h: 40, hue: lane.hue, title: lane.title, sub: lane.sub, titleSize: 11, anchor: 'middle', pad: 3 });
    f.lifeline(cx(index), 48, 400);
  });
  rows.forEach(([from, to, style, label, note], index) => {
    const y = 84 + index * 46;
    f.beat(index + 1);
    f.step(12, y, index + 1);
    const x1 = cx(from);
    const x2 = cx(to);
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label, note: note || undefined });
  });
});
