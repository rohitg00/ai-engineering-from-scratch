'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const run = load(path.join(__dirname, '../../capture/lab/summary/demos-x86.json')).idle_suspender;
const first = run.suspends[0];
const wake = run.requests.find(request => request.kind === 'resumed' && request.t > first.t);

module.exports = figure('fig-9-1', {
  height: 276,
  title: 'The idle suspender in the request path',
  desc: `A client sends a request to the idle suspender, which forwards it through kubectl ate proxy to atenet-router and the actor. The suspender keeps the time of the last request for each actor. In the recorded run it called SuspendActor for the actor ${first.actor} after ${first.idle_seconds} quiet seconds, and the call took ${first.seconds} seconds. A later request found the actor ${wake.actor} suspended, and the router resumed it in ${wake.seconds} seconds.`,
}, f => {
  f.kicker(16, 24, 'one request');
  const client = f.box({ x: 16, y: 36, w: 80, h: 46, hue: 'olive', title: 'client', sub: 'curl' });
  const suspender = f.box({ x: 124, y: 36, w: 156, h: 46, hue: 'plum', title: 'idle suspender', sub: 'one Python file' });
  const proxy = f.box({ x: 308, y: 36, w: 156, h: 46, hue: 'olive', title: 'kubectl ate proxy', sub: 'one for each actor' });
  const router = f.box({ x: 492, y: 36, w: 132, h: 46, hue: 'indigo', title: 'atenet-router', sub: 'calls ResumeActor' });
  f.arrow(client.right(), suspender.left(), { style: 'call' });
  f.arrow(suspender.right(), proxy.left(), { style: 'call' });
  f.arrow(proxy.right(), router.left(), { style: 'call' });

  f.kicker(16, 128, 'the decision');
  const table = f.box({ x: 124, y: 140, w: 156, h: 92, hue: 'plum', title: 'last request', sub: ['busy: 2 s ago', `bursty: ${first.idle_seconds} s ago`, 'rare: suspended'] });
  f.arrow(suspender.bottom(), table.top(), { style: 'write' });
  f.text(210, 116, 'writes on each request', { size: 11, hue: 'teal' });
  const api = f.box({ x: 308, y: 163, w: 156, h: 46, hue: 'blue', title: 'ate-api-server', sub: 'SuspendActor' });
  const actor = f.box({ x: 492, y: 163, w: 132, h: 46, hue: 'green', title: 'actor bursty', sub: 'one of two places' });
  f.arrow(table.right(), api.left(), { style: 'state' });
  f.arrow(api.right(), actor.left(), { style: 'state' });
  f.text(386, 254, `quiet for ${first.idle_seconds} s, so suspend: ${first.seconds} s`, { size: 11, hue: 'amber', anchor: 'middle' });
  f.arrow(router.bottom(), actor.top(), { style: 'call' });
  f.text(548, 126, `resume, ${wake.seconds} s`, { size: 11, anchor: 'end', knock: true });
});
