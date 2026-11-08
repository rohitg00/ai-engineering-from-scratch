'use strict';

const { figure } = require('../../../_shared/figkit.js');

const lanes = [
  { x: 20, name: 'sbx CLI', hue: 'grey' },
  { x: 145, name: 'secret store', hue: 'teal' },
  { x: 270, name: 'm101-secret', hue: 'blue' },
  { x: 395, name: 'proxy :3128', hue: 'indigo' },
  { x: 520, name: 'receiver', hue: 'grey' },
];
const cx = index => lanes[index].x + 55;
const rows = [
  [0, 1, 'write', 'set-custom --env M101_RECV_KEY', 'hosts host.docker.internal, localhost'],
  [1, 0, 'reply', 'placeholder sbx-cs-<rand>', null],
  [0, 2, 'state', 'create m101-secret', 'M101_RECV_KEY=sbx-cs-<rand> inside'],
  [2, 3, 'call', 'GET host.docker.internal:18080/from-variable', 'Authorization: Bearer sbx-cs-<rand>'],
  [3, 1, 'call', 'value for the bound host', null],
  [1, 3, 'reply', 'm101-dummy-receiver-0000', null],
  [3, 4, 'call', 'forward, Host: localhost:18080', 'Bearer m101-dummy-receiver-0000'],
  [4, 2, 'reply', '204', null],
  [2, 3, 'fail', 'direct to gateway.docker.internal:18080', 'NO_PROXY, transparent proxy: blocked, no swap'],
  [0, 1, 'write', 'secret rm --placeholder sbx-cs-<rand>', 'Applied secret updates for running sandboxes'],
];

module.exports = figure('fig-3-6', {
  height: 540,
  title: 'One custom secret from the keychain to the receiver',
  desc: 'Five lifelines: the sbx CLI, the secret store, the sandbox m101-secret, the forward proxy on gateway.docker.internal:3128, and the receiver on 127.0.0.1:18080. The CLI stores M101_RECV_KEY for host.docker.internal and localhost and gets the placeholder sbx-cs-<rand>, which the new sandbox carries in its environment. curl inside sends the placeholder as a Bearer token to host.docker.internal:18080. The proxy reads the stored value and forwards the request to localhost:18080 with the real value, and the receiver answers 204. A direct connection to gateway.docker.internal:18080 bypasses the forward proxy and is blocked by the transparent proxy with no swap. Removing the secret updates running sandboxes at once.',
}, f => {
  for (const lane of lanes) {
    f.box({ x: lane.x, y: 10, w: 110, h: 30, hue: lane.hue, title: lane.name, titleSize: 11 });
    f.lifeline(lane.x + 55, 40, 528);
  }
  rows.forEach(([from, to, style, label, note], index) => {
    const y = 78 + index * 48;
    f.beat(index + 1);
    f.step(24, y, index + 1, { hue: style === 'fail' ? 'rose' : undefined });
    const x1 = cx(from);
    const x2 = cx(to);
    const labelX = from === 0 || to === 0 ? Math.max((x1 + x2) / 2, 192) : (x1 + x2) / 2;
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label, note, labelX });
  });
});
