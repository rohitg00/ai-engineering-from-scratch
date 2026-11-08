'use strict';

const { figure } = require('../figkit.js');

const lanes = [{ x: 118, name: 'CLIENT', hue: 'violet' }, { x: 262, name: 'SERVER', hue: 'blue' }, { x: 406, name: 'STORE', hue: 'teal' }, { x: 556, name: 'WORKER', hue: 'olive' }];
const rows = [
  [0, 1, 'call', 'request()', 'a call · solid ink'],
  [1, 2, 'write', 'write 2', 'a durable write · solid teal'],
  [1, 2, 'state', 'task 9 running', 'state change · dashed amber'],
  [1, 3, 'model', 'generate', 'model or compute · solid plum'],
  [1, 3, 'effect', 'execute()', 'outside effect · dashed olive'],
  [1, 0, 'event', 'event frame', 'stream or event · dotted indigo'],
  [1, 3, 'fail', 'abort', 'failure · dashed rose'],
  [1, 0, 'reply', 'done', 'a reply · dashed ink'],
];

module.exports = figure('tpl-sequence', {
  height: 430,
  title: 'Reading a sequence figure',
  desc: 'Four lifelines named client, server, store and worker, with eight numbered exchanges that show each arrow style: call, durable write, state change, model call, outside effect, event, failure and reply.',
}, f => {
  for (const lane of lanes) {
    f.box({ x: lane.x, y: 10, w: 112, h: 30, hue: lane.hue, title: lane.name, titleSize: 12, anchor: 'middle' });
    f.lifeline(lane.x, 40, 418);
  }
  rows.forEach(([from, to, style, label, note], index) => {
    const y = 76 + index * 44;
    f.step(24, y, index + 1);
    const x1 = lanes[from].x;
    const x2 = lanes[to].x;
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label, note, labelX: (x1 + x2) / 2 });
  });
});
