'use strict';

const { figure } = require('../../../_shared/figkit.js');

const lanes = [
  { x: 84, name: 'platform team', sub: 'outside A2A', hue: 'grey' },
  { x: 262, name: 'planner', sub: 'client', hue: 'violet' },
  { x: 548, name: 'deployer', sub: 'port 41243', hue: 'blue' },
];
const rows = [
  [1, 2, 'call', 'GET /.well-known/agent-card.json', null],
  [2, 1, 'reply', 'public card', 'extendedAgentCard: true, scheme bearer'],
  [1, 2, 'call', 'GetExtendedAgentCard', 'no Authorization header'],
  [2, 1, 'fail', 'HTTP 401 Unauthorized', 'WWW-Authenticate: Bearer realm="deployer"'],
  [0, 1, 'effect', 'bearer token', 'issued outside A2A'],
  [1, 2, 'call', 'GetExtendedAgentCard', 'Authorization: Bearer dpl_test_7c1e4b'],
  [2, 1, 'reply', 'extended card', 'skills deploy and rollback, unsigned'],
];

module.exports = figure('fig-extended-card', {
  height: 420,
  title: 'Earning the extended card',
  desc: 'Three lifelines: the platform team outside A2A, the planner, and the deployer. Seven steps appear in order. The planner reads the public card, which declares extendedAgentCard true and a bearer scheme. It calls GetExtendedAgentCard without an Authorization header and gets HTTP 401 with WWW-Authenticate: Bearer realm="deployer". The platform team issues a bearer token outside A2A. The planner calls again with the token and receives the extended card, whose skills are deploy and rollback and which carries no signature.',
}, f => {
  for (const lane of lanes) {
    f.box({ x: lane.x, y: 10, w: 132, h: 40, hue: lane.hue, title: lane.name, titleSize: 12, sub: lane.sub, anchor: 'middle' });
    f.lifeline(lane.x, 50, 408);
  }
  rows.forEach(([from, to, style, label, note], index) => {
    const y = 84 + index * 48;
    f.beat(index + 1);
    f.step(20, y, index + 1);
    const x1 = lanes[from].x;
    const x2 = lanes[to].x;
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label, note, labelX: (x1 + x2) / 2 });
  });
});
