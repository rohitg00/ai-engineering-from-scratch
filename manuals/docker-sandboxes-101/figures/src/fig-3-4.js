'use strict';

const { figure } = require('../../../_shared/figkit.js');

const lanes = [
  { x: 20, name: 'curl inside', hue: 'blue' },
  { x: 145, name: 'proxy :3128', hue: 'indigo' },
  { x: 270, name: 'sandboxd', hue: 'blue' },
  { x: 395, name: 'policy store', hue: 'teal' },
  { x: 520, name: 'example.com', hue: 'grey' },
];
const cx = index => lanes[index].x + 55;
const rows = [
  [0, 1, 'call', 'CONNECT example.com:443', 'HTTPS_PROXY in the environment'],
  [1, 2, 'call', 'op(net:connect:tcp, example.com:443)', null],
  [2, 3, 'call', 'match rules for sandbox:m101-policy', null],
  [3, 2, 'reply', 'no applicable policies', null],
  [2, 1, 'fail', 'No matching allow rule (default deny)', null],
  [1, 0, 'fail', 'HTTP/1.1 403 Forbidden, 90 bytes', 'inside TLS, under the proxy CA'],
  [2, 3, 'write', 'log: blocked example.com:443 forward', null],
  [2, 3, 'write', 'policy allow network --sandbox m101-policy', 'rule <uuid> example.com [tcp]'],
  [0, 1, 'call', 'CONNECT example.com:443', null],
  [2, 1, 'reply', 'allowed, forward-bypass', null],
  [1, 4, 'call', 'TLS tunnel, no inspection', 'HTTP/1.0 200 Connection established'],
  [4, 0, 'reply', 'HTTP/2 200, server: cloudflare', null],
  [2, 3, 'write', 'log: allowed example.com:443 forward-bypass', null],
];

module.exports = figure('fig-3-4', {
  height: 640,
  title: 'One blocked and one allowed request to example.com',
  desc: 'Five lifelines: curl inside m101-policy, the forward proxy on gateway.docker.internal:3128, sandboxd with its authorizer, the policy store, and example.com. The first CONNECT is checked by sandboxd, finds no applicable policy, and the proxy answers 403 Forbidden inside the TLS session with a 90-byte approval message, then logs the host as blocked with proxy type forward. An allow rule for example.com is written in the sandbox scope. The second CONNECT is allowed as forward-bypass, the proxy opens a tunnel without inspection, example.com answers HTTP/2 200, and the host is logged as allowed.',
}, f => {
  for (const lane of lanes) {
    f.box({ x: lane.x, y: 10, w: 110, h: 30, hue: lane.hue, title: lane.name, titleSize: 11, anchor: undefined });
    f.lifeline(lane.x + 55, 40, 628);
  }
  rows.forEach(([from, to, style, label, note], index) => {
    const y = 76 + index * 43;
    f.beat(index + 1);
    f.step(24, y, index + 1, { hue: style === 'fail' ? 'rose' : undefined });
    const x1 = cx(from);
    const x2 = cx(to);
    const labelX = from === 0 || to === 0 ? Math.max((x1 + x2) / 2, 192) : (x1 + x2) / 2;
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label, note, labelX });
  });
});
