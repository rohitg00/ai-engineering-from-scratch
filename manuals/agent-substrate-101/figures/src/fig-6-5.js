'use strict';

const { figure } = require('../../../_shared/figkit.js');

const lanes = [
  { title: 'actor f-main', sub: 'holds no secret', hue: 'green' },
  { title: 'atenet-egress', sub: 'one http rule', hue: 'indigo' },
  { title: 'credential', sub: 'provider k8s.io', hue: 'blue' },
  { title: 'Secret', sub: 'cred-ns/api-token', hue: 'grey' },
  { title: 'whoami', sub: 'upstream host', hue: 'olive' },
];
const cx = index => 76 + index * 124;

const rows = [
  [0, 1, 'call', 'Authorization: placeholder', 'GET / through the tunnel'],
  [1, 2, 'call', 'FetchSecret', 'reference, actor identity'],
  [2, 3, 'call', 'read key token', 'lab-f can use cred-ns'],
  [2, 1, 'reply', 'the secret', null],
  [1, 4, 'call', 'Authorization: Bearer <secret>', 'the gateway overwrote the value'],
  [4, 0, 'fail', '200, body repeats the request headers', 'the actor reads the secret'],
];

module.exports = figure('fig-6-5', {
  height: 366,
  title: 'One request with a placeholder header',
  desc: 'Five lifelines: the actor f-main, atenet-egress, the credential provider k8s.io, the Kubernetes Secret cred-ns/api-token, and the upstream host whoami. Six numbered exchanges: the actor sends a request with the header Authorization set to a placeholder, atenet-egress calls FetchSecret with the reference and the actor identity, the provider reads the key token of the Secret, and it returns the secret. atenet-egress sends the request upstream with Authorization set to Bearer and the secret. The upstream answers 200 with a body that repeats the request headers, so the actor reads the secret.',
}, f => {
  lanes.forEach((lane, index) => {
    f.box({ x: cx(index), y: 8, w: 118, h: 40, hue: lane.hue, title: lane.title, sub: lane.sub, titleSize: 11, anchor: 'middle', pad: 3 });
    f.lifeline(cx(index), 48, 356);
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
