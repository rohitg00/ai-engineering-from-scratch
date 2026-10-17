'use strict';

const { figure } = require('../../../_shared/figkit.js');

const lanes = [
  { x: 84, name: 'client', hue: 'olive' },
  { x: 242, name: 'gateway', hue: 'blue' },
  { x: 400, name: 'prefill', sub: 'bootstrap :8998', hue: 'blue' },
  { x: 558, name: 'decode', hue: 'blue' },
];

const rows = [
  [0, 1, 'call', 'POST /generate', null],
  [1, 2, 'call', 'request + bootstrap_room', 'one random 63-bit number'],
  [1, 3, 'call', 'same request, same room', 'sent at the same time'],
  [3, 2, 'call', '/route, then slot addresses', 'decode reserves KV slots first'],
  [2, 3, 'write', 'KV pages by RDMA write', 'after the prefill forward pass'],
  [3, 0, 'event', 'token stream', 'decode serves the client'],
];

module.exports = figure('fig-6-3', {
  height: 380,
  title: 'One disaggregated request',
  desc: 'Four lifelines: client, gateway, prefill server with its bootstrap server on port 8998, and decode server. The client posts a request to the gateway. The gateway sends it with a bootstrap room to prefill and to decode at the same time. Decode looks up the prefill rank and sends the addresses of reserved KV slots. Prefill runs its forward pass and writes the KV pages into those slots by RDMA. Decode streams tokens to the client.',
}, f => {
  for (const lane of lanes) {
    f.box({ x: lane.x, y: 10, w: 132, h: lane.sub ? 44 : 30, hue: lane.hue, title: lane.name, sub: lane.sub ? [lane.sub] : undefined, anchor: 'middle' });
    f.lifeline(lane.x, lane.sub ? 54 : 40, 370);
  }
  rows.forEach(([from, to, style, label, note], index) => {
    const y = 92 + index * 48;
    f.beat(index + 1);
    f.step(16, y, index + 1);
    const x1 = lanes[from].x;
    const x2 = lanes[to].x;
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label, note, labelX: (x1 + x2) / 2 });
  });
});
