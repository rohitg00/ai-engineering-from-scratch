'use strict';

const { figure } = require('../../../_shared/figkit.js');

const lanes = [
  { x: 80, name: 'your code', hue: 'violet' },
  { x: 232, name: 'traceable', hue: 'blue' },
  { x: 392, name: 'callbacks', hue: 'blue' },
  { x: 556, name: 'the client', hue: 'olive' },
];
const rows = [
  [0, 1, 'call', 'pipeline() in "local"', 'a traceable function'],
  [1, 0, 'reply', 'RunTree to on_end', 'kept in memory, 0 requests'],
  [0, 2, 'call', 'agent.invoke() in "local"', 'LangChain code'],
  [2, 2, 'state', 'tracing on: "local" is truthy', 'LangChainTracer added'],
  [2, 3, 'fail', 'POST /runs 7, PATCH 7', 'sent, although local'],
  [0, 2, 'call', 'invoke() in enabled=False', 'inside collect_runs()'],
  [2, 0, 'reply', '4 runs in traced_runs', 'kept in memory, 0 requests'],
];

module.exports = figure('fig-6-4c', {
  height: 420,
  title: 'What tracing_context(enabled="local") keeps and sends',
  desc: 'Four lifelines: your code, the traceable wrapper of langsmith, the LangChain callback manager, and the LangSmith client. A traceable function inside tracing_context with enabled set to local builds a run tree and gives it to on_end, and the client gets no request. An agent.invoke inside the same context turns tracing on, because the callback manager treats the string local as true and adds a LangChainTracer, which sends POST /runs 7 times and PATCH 7 times. The same invoke inside tracing_context with enabled set to False and inside collect_runs keeps four top runs in memory and sends nothing.',
}, f => {
  for (const lane of lanes) {
    f.box({ x: lane.x, y: 10, w: 116, h: 30, hue: lane.hue, title: lane.name, titleSize: 12, anchor: 'middle' });
    f.lifeline(lane.x, 40, 408);
  }
  rows.forEach(([from, to, style, label, note], index) => {
    const y = 80 + index * 48;
    f.step(16, y, index + 1);
    const x1 = lanes[from].x;
    const x2 = lanes[to].x;
    if (from === to) {
      f.path(`M${x1} ${y - 8} H${x1 + 30} V${y + 8} H${x1 + 1}`, { style });
      f.text(x1 + 38, y - 2, label, { size: 11.5, hue: 'amber', knock: true });
      f.text(x1 + 38, y + 13, note, { size: 11, serif: true, hue: 'ink-soft', knock: true });
      return;
    }
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label, note, labelX: (x1 + x2) / 2 });
  });
});
