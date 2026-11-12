'use strict';

const fs = require('fs');
const path = require('path');
const { figure } = require('../../../_shared/figkit.js');

const trace = fs.readFileSync(path.join(__dirname, '../../capture/lab/B-lifecycle/10-trace.tsv'), 'utf8').trim().split('\n').map(line => line.split('\t'));
const calls = trace.filter(row => /^call-\d$/.test(row[1])).map(row => Number(row[3]));
const afterIdle = Number(trace.find(row => row[1] === 'call-after-idle')[3]);
const idle = trace.find(row => row[1] === 'idle-watch-start')[2].replace('no requests for ', '');
const samples = trace.filter(row => row[1] === 'state').length - 3;
const first = calls[0];
const warm = calls.slice(1);
const s = value => `${value.toFixed(3)} s`;
const low = Math.min(...warm);
const high = Math.max(...warm);

module.exports = figure('plate-substrate-request', {
  height: 604,
  title: 'One request wakes one actor',
  desc: `A client sends one request through kubectl ate proxy to atenet-router. The router calls ResumeActor on ate-api-server, which reads the actor row in Postgres. Below them is one worker pod on the node kind-control-plane. On it, atelet restores the golden snapshot from the object store, and the actor my-counter-1 goes from SUSPENDED to RUNNING. The router then opens a tunnel to the actor. On our x86 server guest the first request took ${s(first)}, the next four took ${s(low)} to ${s(high)}, and a request after ${idle} with no traffic took ${s(afterIdle)} because the actor was still running.`,
}, f => {
  const top = f.isoView({ ox: 0, oy: 150, angle: 'true' });
  const base = f.isoView({ ox: 0, oy: 404, angle: 'true' });
  const unit = (view, cx, cc, size, h, hue, options = {}) => {
    const [xc, yc] = view.at(cx, cc);
    return f.isoBlock(view, { x: xc - size / 2, y: yc - size / 2, w: size, d: size, h, hue, ...options });
  };

  f.kicker(20, 18, 'the request path · Agent Substrate v1.0.0');
  f.text(620, 18, 'my-counter-1', { size: 11, anchor: 'end', hue: 'ink-soft' });
  const labels = [
    { cx: 85, w: 130, hue: 'olive', title: 'client', sub: 'curl, the proxy' },
    { cx: 237, w: 144, hue: 'indigo', title: 'atenet-router', sub: 'asks every time' },
    { cx: 393, w: 144, hue: 'blue', title: 'ate-api-server', sub: 'ResumeActor' },
    { cx: 547, w: 130, hue: 'teal', title: 'Postgres', sub: 'the actor row' },
  ];
  labels.forEach(p => f.box({ x: p.cx - p.w / 2, y: 30, w: p.w, h: 52, hue: p.hue, title: p.title, sub: [p.sub] }));
  f.isoBeam(top, { sx0: 160, sx1: 626, c: 50, back: 100, h: 6, hue: 'paper', inkHue: 'ink-mute', ink: 1, shadow: false });
  const client = unit(top, 85, 0, 42, 26, 'olive');
  const router = unit(top, 237, 0, 42, 26, 'indigo');
  const api = unit(top, 393, 0, 42, 26, 'blue');
  const [px, py] = top.at(547, 0);
  const pg = f.isoDrum(top, { x: px, y: py, r: 20, h: 26, hue: 'teal' });
  [client, router, api].forEach((block, index) => f.leader([labels[index].cx, 84], block.top, { hue: labels[index].hue }));
  f.leader([547, 84], pg.top, { hue: 'teal' });

  const hop = (a, b, style, label, beat) => {
    const from = a.P(42, 0, 13);
    const to = b.P(0, 42, 13);
    f.beat(beat);
    f.path(`M${from[0] + 2} ${from[1]} L${to[0] - 2} ${to[1]}`, { style });
    f.text((from[0] + to[0]) / 2, from[1] - 8, label, { size: 11, anchor: 'middle', knock: true });
    f.step((from[0] + to[0]) / 2, from[1] + 14, beat);
  };
  hop(client, router, 'call', 'POST /', 1);
  hop(router, api, 'call', 'ResumeActor', 2);
  f.beat(3);
  const apiSide = api.P(42, 0, 13);
  f.path(`M${apiSide[0] + 2} ${apiSide[1]} L${pg.center[0] - 32} ${apiSide[1]}`, { style: 'write' });
  f.text((apiSide[0] + pg.center[0] - 30) / 2, apiSide[1] - 8, 'read, bind', { size: 11, anchor: 'middle', hue: 'teal', knock: true });
  f.step((apiSide[0] + pg.center[0] - 30) / 2, apiSide[1] + 14, 3, { hue: 'teal' });

  f.beat(0);
  f.text(20, 204, 'namespace ate-system', { size: 11, serif: true, hue: 'ink-mute' });
  f.rule(20, 214, 620, 214, { dash: 'dashed' });
  f.kicker(20, 234, 'node kind-control-plane');
  f.text(620, 234, 'one worker pod, gVisor', { size: 11, anchor: 'end', serif: true, hue: 'ink-mute' });

  f.isoBeam(base, { sx0: 14, sx1: 626, c: 130, back: 290, h: 8, hue: 'violet' });
  const Z = 8;
  const actor = unit(base, 237, -15, 56, 30, 'green', { z: Z });
  const atelet = unit(base, 393, -15, 42, 22, 'violet', { z: Z });
  const [sx, sy] = base.at(547, -15);
  const store = f.isoDrum(base, { x: sx, y: sy, r: 22, h: 30, z: Z, hue: 'teal' });

  f.text(20, 258, 'actor my-counter-1', { size: 12, weight: 700, hue: 'green' });
  f.text(20, 274, 'memory, files, rootfs', { size: 11, serif: true, hue: 'ink-soft' });
  f.leader([60, 280], actor.P(0, 56, 15), { hue: 'green' });
  f.text(620, 258, 'object store', { size: 12, weight: 700, anchor: 'end', hue: 'teal' });
  f.text(620, 274, 'the golden snapshot', { size: 11, serif: true, anchor: 'end', hue: 'ink-soft' });
  f.leader([570, 280], store.top, { hue: 'teal' });
  f.text(393, 504, 'atelet', { size: 12, weight: 700, anchor: 'middle', hue: 'violet' });
  f.leader([393, 490], atelet.near, { hue: 'violet' });

  f.beat(4);
  const apiDown = api.P(21, 42, 0);
  f.path(`M${apiDown[0]} ${apiDown[1] + 2} L${apiDown[0]} ${atelet.top[1] - 4}`, { style: 'call' });
  f.text(apiDown[0] + 30, 296, 'Restore', { size: 11.5, knock: true });
  f.step(apiDown[0] + 16, 292, 4);
  f.beat(5);
  const ateletSide = atelet.P(42, 0, 11);
  f.path(`M${store.center[0] - 34} ${ateletSide[1]} L${ateletSide[0] + 3} ${ateletSide[1]}`, { style: 'write' });
  f.step((store.center[0] - 34 + ateletSide[0]) / 2, ateletSide[1] - 14, 5);
  const ateletLeft = atelet.P(0, 42, 11);
  const actorRight = actor.P(56, 0, 15);
  f.path(`M${ateletLeft[0] - 2} ${ateletLeft[1]} L${actorRight[0] + 3} ${actorRight[1]}`, { style: 'state' });
  f.text(200, 504, 'SUSPENDED to RUNNING', { size: 11.5, anchor: 'middle', hue: 'amber' });
  f.leader([200, 490], actor.near, { hue: 'amber' });
  f.beat(6);
  const routerDown = router.P(21, 42, 0);
  f.path(`M${routerDown[0]} ${routerDown[1] + 2} L${routerDown[0]} ${actor.top[1] - 4}`, { style: 'event' });
  f.text(routerDown[0] + 30, 296, 'tunnel, port 8443', { size: 11.5, hue: 'indigo', knock: true });
  f.step(routerDown[0] + 16, 292, 6, { hue: 'indigo' });

  f.beat(7);
  f.kicker(20, 544, 'client time through kubectl ate proxy, x86 server guest');
  f.text(20, 566, `first request ${s(first)}`, { size: 12, weight: 700, hue: 'amber' });
  f.text(330, 566, `next four ${s(low)} to ${s(high)}`, { size: 12, weight: 700, hue: 'green' });
  f.beat(0);
  f.text(20, 590, `after ${idle} with no request: ${samples} of ${samples} samples RUNNING, then ${s(afterIdle)}`, { size: 11, serif: true, hue: 'ink-mute' });
});
