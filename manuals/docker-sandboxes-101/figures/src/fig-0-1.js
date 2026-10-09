'use strict';

const { figure } = require('../../../_shared/figkit.js');

const lanes = [
  { title: 'sbx', sub: 'CLI', hue: 'blue' },
  { title: 'sandboxd', sub: 'host daemon', hue: 'blue' },
  { title: 'policy store', sub: 'local policy', hue: 'teal' },
  { title: 'sandbox VM', sub: 'the guest', hue: 'blue' },
  { title: 'proxy :3128', sub: 'on the host', hue: 'indigo' },
  { title: 'example.com', sub: 'outside', hue: 'grey' },
  { title: 'Model Runner', sub: ':12434', hue: 'plum' },
];
const cx = index => 52 + index * 89;

const rows = [
  [3, 4, 'call', 'CONNECT example.com:443', 'a call · solid ink'],
  [4, 3, 'fail', '403 Forbidden', 'a failure · dashed rose'],
  [0, 1, 'call', 'allow network', 'a call · solid ink'],
  [1, 2, 'write', 'example.com [tcp]', 'a durable write · solid teal'],
  [1, 0, 'reply', 'Rule added', 'a reply · dashed ink'],
  [3, 4, 'call', 'CONNECT example.com:443', 'the same call, now allowed'],
  [4, 5, 'effect', 'tunnel to :443', 'an outside effect · dashed olive'],
  [3, 6, 'model', 'POST chat/completions', 'a model call · solid plum'],
  [6, 3, 'event', 'chat.completion.chunk', 'a stream · dotted indigo'],
  [1, 3, 'state', 'running to stopped', 'a state change · dashed amber'],
];

module.exports = figure('fig-0-1', {
  height: 540,
  title: 'Reading a sequence figure in this manual',
  desc: 'Seven lifelines: the sbx CLI, the sandboxd daemon, the local policy store, a sandbox VM, the host proxy on port 3128, example.com, and Docker Model Runner on port 12434. Ten numbered rows use the eight arrow styles: a CONNECT to example.com:443 as a solid ink call, 403 Forbidden as a dashed rose failure, sbx policy allow network as a call, the rule example.com [tcp] as a solid teal durable write, Rule added as a dashed ink reply, the second CONNECT, the tunnel to example.com as a dashed olive outside effect, POST chat/completions as a solid plum model call, chat.completion.chunk as a dotted indigo stream, and running to stopped as a dashed amber state change.',
}, f => {
  lanes.forEach((lane, index) => {
    f.box({ x: cx(index), y: 8, w: 86, h: 40, hue: lane.hue, title: lane.title, sub: lane.sub, titleSize: 11, anchor: 'middle', pad: 3 });
    f.lifeline(cx(index), 48, 532);
  });
  rows.forEach(([from, to, style, label, note], index) => {
    const y = 84 + index * 46;
    f.beat(index + 1);
    f.step(16, y, index + 1, { hue: style === 'fail' ? 'rose' : undefined });
    const x1 = cx(from);
    const x2 = cx(to);
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label, note });
  });
});
