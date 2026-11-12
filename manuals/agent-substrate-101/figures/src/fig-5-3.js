'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-5-3', {
  height: 330,
  title: 'How an actor JWT reaches the service that an actor calls',
  desc: 'A sequence with four lifelines: the actor session-01a1cf43, the egress gateway atenet-egress, ate-api-server, and the service kagent-controller on port 8083. The actor sends a plain HTTP request. The gateway matches the egress rule, calls MintActorJwt with the audience kagent-runtime and 300 seconds, replaces the authorization header with the token, and sends the request on. The service answers 200. The actor never holds the token.',
}, f => {
  const lanes = [
    { x: 80, hue: 'green', title: 'actor', sub: 'session-01a1cf43' },
    { x: 240, hue: 'indigo', title: 'atenet-egress', sub: 'egress gateway' },
    { x: 400, hue: 'blue', title: 'ate-api-server', sub: 'signs with ES256' },
    { x: 560, hue: 'plum', title: 'kagent-controller', sub: 'port 8083' },
  ];
  lanes.forEach(lane => {
    f.box({ x: lane.x, y: 16, w: 140, h: 44, hue: lane.hue, title: lane.title, sub: lane.sub, anchor: 'middle', titleSize: 12, pad: 6 });
    f.lifeline(lane.x, 60, 316);
  });
  const [actor, gw, api, svc] = lanes.map(lane => lane.x);
  f.step(actor - 60, 92, 1);
  f.arrow([actor, 92], [gw - 1, 92], { style: 'call', label: 'HTTP request', note: 'no credential' });
  f.step(gw - 12, 142, 2);
  f.text(gw + 10, 138, 'rule matches: http, port 8083', { size: 11, serif: true, hue: 'ink-soft', knock: true });
  f.text(gw + 10, 154, 'effect: actorJwt', { size: 11, serif: true, hue: 'ink-soft', knock: true });
  f.step(actor - 60, 190, 3);
  f.arrow([gw, 190], [api - 1, 190], { style: 'call', label: 'MintActorJwt', note: 'kagent-runtime, 300 s' });
  f.arrow([api, 230], [gw + 1, 230], { style: 'reply', label: 'token' });
  f.step(actor - 60, 270, 4);
  f.arrow([gw, 270], [svc - 1, 270], { style: 'call', label: 'authorization: Bearer token', labelX: 400 });
  f.arrow([svc, 304], [actor + 1, 304], { style: 'reply', label: '200', labelX: 160 });
});
