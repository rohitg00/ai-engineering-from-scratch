'use strict';

const { figure } = require('../../../_shared/figkit.js');

const lanes = [
  { x: 80, name: 'client', hue: 'olive' },
  { x: 240, name: 'TokenizerManager', hue: 'blue' },
  { x: 400, name: 'scheduler', hue: 'blue' },
  { x: 560, name: 'detokenizer', hue: 'blue' },
];

const rows = [
  [0, 1, 'call', 'POST, stream true'],
  [1, 2, 'event', 'tokenized request'],
  [2, 3, 'event', 'new token ids'],
  [3, 1, 'event', 'new text'],
  [1, 0, 'event', 'SSE chunk'],
  [2, 2, 'state', 'holds a possible stop prefix'],
  [2, 2, 'state', 'stop string matched, finish'],
  [2, 3, 'event', 'last ids, finish_reason stop'],
  [3, 1, 'event', 'text with the stop trimmed'],
  [1, 0, 'reply', 'last chunk, then [DONE]'],
];

module.exports = figure('fig-2-5', {
  height: 492,
  title: 'One streamed request with a stop string',
  desc: 'Four lifelines: client, TokenizerManager, scheduler, and detokenizer. The client posts a streaming request, the scheduler sends token ids to the detokenizer, which sends text back for the client as SSE chunks. The scheduler holds back text whose tail could start a stop string, then matches the stop string and finishes, and the detokenizer trims the stop text before the last chunk.',
}, f => {
  for (const lane of lanes) {
    f.box({ x: lane.x, y: 10, w: 140, h: 30, hue: lane.hue, title: lane.name, titleSize: 12, anchor: 'middle' });
    f.lifeline(lane.x, 40, 484);
  }
  rows.forEach(([from, to, style, label], index) => {
    const y = 76 + index * 41;
    f.step(20, y, index + 1);
    const x1 = lanes[from].x;
    const x2 = lanes[to].x;
    if (from === to) {
      f.dot(x1, y, { hue: 'amber', r: 4 });
      f.text(x1 + 12, y + 4, label, { size: 11, hue: 'amber', knock: true });
      return;
    }
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label, labelX: (x1 + x2) / 2 });
  });
});
