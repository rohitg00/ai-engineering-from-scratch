'use strict';

const { figure } = require('../../../_shared/figkit.js');

const lanes = [
  { title: 'your code', sub: 'agent.invoke', hue: 'violet' },
  { title: 'agent graph', sub: 'create_agent', hue: 'indigo' },
  { title: 'chat model', sub: 'scripted fake', hue: 'plum' },
  { title: 'tool', sub: 'add, flaky_disk', hue: 'green' },
  { title: 'checkpointer', sub: 'InMemorySaver', hue: 'teal' },
  { title: 'LangSmith', sub: 'outside', hue: 'olive' },
];
const cx = index => 60 + index * 104;

const rows = [
  [0, 1, 'call', 'invoke: What is 2 + 3?', 'a call · solid ink'],
  [1, 2, 'model', 'system: You add numbers.', 'a model call · solid plum'],
  [2, 1, 'reply', 'tool_calls: add(a=2, b=3)', 'a reply · dashed ink'],
  [1, 4, 'write', 'checkpoint step 1', 'a durable write · solid teal'],
  [1, 3, 'state', 'next: tools', 'a state change · dashed amber'],
  [1, 0, 'event', 'custom: lookup A-17', 'a stream · dotted indigo'],
  [1, 5, 'effect', 'POST /runs, 7 times', 'an outside effect · dashed olive'],
  [3, 1, 'fail', 'RuntimeError: disk on fire', 'a failure · dashed rose'],
];

module.exports = figure('fig-0-1', {
  height: 470,
  title: 'Reading a sequence figure in this manual',
  desc: 'Six lifelines: your code, the agent graph from create_agent, the chat model, a tool, the checkpointer, and LangSmith outside the process. Eight numbered rows use the eight arrow styles: invoke with What is 2 + 3? as a solid ink call, the system prompt You add numbers. as a solid plum model call, the tool call add with a=2 and b=3 as a dashed ink reply, checkpoint step 1 as a solid teal durable write, next tools as a dashed amber state change, the custom stream value lookup A-17 as a dotted indigo stream, seven POST /runs requests as a dashed olive outside effect, and RuntimeError disk on fire as a dashed rose failure.',
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
