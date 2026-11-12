'use strict';

const { figure } = require('../../../_shared/figkit.js');

const lanes = [
  { title: 'client', sub: 'curl', hue: 'olive' },
  { title: 'atenet-router', sub: 'dataplane', hue: 'indigo' },
  { title: 'ate-api-server', sub: 'control plane', hue: 'blue' },
  { title: 'Postgres', sub: 'actor rows', hue: 'teal' },
  { title: 'worker pod', sub: 'my-counter-1', hue: 'violet' },
  { title: 'other hosts', sub: 'not Substrate', hue: 'olive' },
];
const cx = index => 60 + index * 104;

const rows = [
  [0, 1, 'call', 'POST /, ate-target-actor', 'a call · solid ink'],
  [2, 3, 'write', 'worker assignment row', 'a durable write · solid teal'],
  [2, 4, 'state', 'SUSPENDED to RUNNING', 'a state change · dashed amber'],
  [1, 4, 'event', 'CONNECT tunnel, port 8443', 'a stream · dotted indigo'],
  [4, 5, 'model', 'POST to mock-llm:8080', 'a model call · solid plum'],
  [4, 5, 'effect', 'GET https://example.org/, 200', 'an outside effect · dashed olive'],
  [1, 0, 'reply', '200, count 1, 0.36 s', 'a reply · dashed ink'],
  [1, 0, 'fail', '503 no worker has room', 'a failure · dashed rose'],
];

module.exports = figure('fig-0-1', {
  height: 470,
  title: 'Reading a sequence figure in this manual',
  desc: 'Six lifelines: the client, atenet-router, ate-api-server, Postgres, the worker pod that runs my-counter-1, and other hosts. Eight numbered rows use the eight arrow styles: POST with the ate-target-actor header as a solid ink call, the worker assignment row as a solid teal durable write, SUSPENDED to RUNNING as a dashed amber state change, the CONNECT tunnel on port 8443 as a dotted indigo stream, a POST to mock-llm as a solid plum model call, a GET to example.org as a dashed olive outside effect, 200 with count 1 in 0.36 s as a dashed ink reply, and 503 no worker has room as a dashed rose failure.',
}, f => {
  lanes.forEach((lane, index) => {
    f.box({ x: cx(index), y: 8, w: 100, h: 40, hue: lane.hue, title: lane.title, sub: lane.sub, titleSize: 11, anchor: 'middle', pad: 3 });
    f.lifeline(cx(index), 48, 460);
  });
  rows.forEach(([from, to, style, label, note], index) => {
    const y = 84 + index * 48;
    f.beat(index + 1);
    f.step(16, y, index + 1, { hue: style === 'fail' ? 'rose' : undefined });
    const x1 = cx(from);
    const x2 = cx(to);
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label, note });
  });
});
