'use strict';

const { figure } = require('../../../_shared/figkit.js');

const lanes = [
  { x: 66, name: 'client', sub: 'kagent CLI', hue: 'olive' },
  { x: 196, name: 'kagent', sub: 'controller :8083', hue: 'plum' },
  { x: 326, name: 'atenet-router', sub: 'agentgateway', hue: 'indigo' },
  { x: 456, name: 'ate-api-server', sub: 'ate-system', hue: 'blue' },
  { x: 574, name: 'actor', sub: 'session-<uuid>', hue: 'green' },
];
const rows = [
  [0, 1, 'call', 'message', 'A2A, with the Session id'],
  [1, 2, 'call', 'ate-target-actor', 'mTLS, port 443'],
  [2, 3, 'call', 'ResumeActor', 'the router asks'],
  [3, 4, 'state', 'RUNNING', '0.38 s median'],
  [2, 4, 'call', 'the turn', 'gRPC to port 80 of the actor'],
  [1, 3, 'call', 'SuspendActor', 'synchronous, files only'],
  [3, 4, 'state', 'SUSPENDED', '0.14 s median'],
  [1, 0, 'reply', 'answer', '1.22 s in total'],
];

module.exports = figure('fig-7-1', {
  height: 440,
  title: 'One kagent turn resumes the Session actor, runs, and suspends it again',
  desc: 'Five lifelines: the client, the kagent controller, atenet-router, ate-api-server, and the actor named session-uuid. Eight numbered exchanges show one turn. The router asks for ResumeActor and the actor is RUNNING after a median of 0.38 seconds. The turn runs. kagent calls SuspendActor and the actor is SUSPENDED after a median of 0.14 seconds. The client has its answer after 1.22 seconds.',
}, f => {
  for (const lane of lanes) {
    f.box({ x: lane.x, y: 10, w: 120, h: 46, hue: lane.hue, title: lane.name, titleSize: 11.5, sub: lane.sub, anchor: 'middle', pad: 6 });
    f.lifeline(lane.x, 56, 428);
  }
  rows.forEach(([from, to, style, label, note], index) => {
    const y = 92 + index * 44;
    f.step(18, y, index + 1);
    const x1 = lanes[from].x;
    const x2 = lanes[to].x;
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label, note, labelX: (x1 + x2) / 2 });
  });
});
