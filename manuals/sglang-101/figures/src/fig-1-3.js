'use strict';

const { figure } = require('../../../_shared/figkit.js');

const lanes = [
  { x: 70, name: 'client', hue: 'olive', w: 110 },
  { x: 220, name: 'TokenizerManager', hue: 'blue' },
  { x: 390, name: 'Scheduler', hue: 'blue' },
  { x: 560, name: 'Detokenizer', hue: 'blue' },
];

module.exports = figure('fig-1-3', {
  height: 470,
  title: 'One /generate request through the three processes',
  desc: 'Four lifelines: the client, the tokenizer manager, the scheduler, and the detokenizer. The client posts a five-token prompt. The tokenizer manager sends token ids to the scheduler over ZMQ. The scheduler matches two cached tokens in the radix cache, prefills three, and returns the first token after 68 ms. Eleven decode steps follow, and the detokenizer returns the text, for 725 ms end to end.',
}, f => {
  for (const lane of lanes) {
    f.box({ x: lane.x, y: 10, w: lane.w || 150, h: 30, hue: lane.hue, title: lane.name, titleSize: 12, anchor: 'middle' });
    f.lifeline(lane.x, 40, 462);
  }
  const rows = [
    [0, 1, 'call', 'POST /generate', 'The capital of France is'],
    [1, 2, 'event', '5 token ids', 'one ZMQ message'],
    [2, 2, null, 'match_prefix', '2 tokens cached'],
    [2, 2, null, 'prefill', '3 new tokens'],
    [2, 3, 'event', 'first token', '68 ms after the request'],
    [2, 3, 'event', '11 more tokens', 'decode steps, 657 ms'],
    [3, 1, 'event', 'text', 'Paris. The capital of Italy is'],
    [1, 0, 'reply', '200 OK', 'e2e_latency 0.725 s'],
  ];
  rows.forEach(([from, to, style, label, note], index) => {
    const y = 74 + index * 48;
    f.beat(index + 1);
    f.step(16, y, index + 1);
    const x1 = lanes[from].x;
    if (from === to) {
      const hue = label === 'match_prefix' ? 'green' : 'plum';
      f.box({ x: x1 - 66, y: y - 16, w: 132, h: 40, hue, title: label, sub: note });
      return;
    }
    const x2 = lanes[to].x;
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label, note, labelX: (x1 + x2) / 2 });
  });
});
