'use strict';

const { figure } = require('../../../_shared/figkit.js');

const lanes = [
  { title: 'your code', sub: 'invoke', hue: 'violet' },
  { title: 'model node', sub: 'model', hue: 'indigo' },
  { title: 'chat model', sub: 'scripted fake', hue: 'plum' },
  { title: 'tools node', sub: 'add', hue: 'green' },
  { title: 'checkpointer', sub: 'InMemorySaver', hue: 'teal' },
];
const cx = index => 64 + index * 128;

const rows = [
  [0, 4, 'write', 'step -1, input', 'next: __start__'],
  [0, 4, 'write', 'step 0, human message', 'next: model'],
  [1, 2, 'model', 'system + human', null],
  [2, 1, 'reply', 'tool_calls: add(2, 3)', null],
  [1, 4, 'write', 'step 1', 'next: tools'],
  [3, 4, 'write', 'step 2, ToolMessage 5', 'next: model'],
  [1, 2, 'model', 'system + 3 messages', null],
  [2, 1, 'reply', 'The sum is 5.', null],
  [1, 4, 'write', 'step 3', 'next: none'],
  [1, 0, 'reply', '4 messages', null],
];

module.exports = figure('fig-1-2', {
  height: 560,
  title: 'One create_agent run, step by step',
  desc: 'Five lifelines: your code, the model node, the chat model, the tools node, and the checkpointer. Ten rows from top to bottom: the input checkpoint at step -1, the checkpoint at step 0 with the human message and next model, the model call with the system prompt and the human message, the reply with a tool call to add with 2 and 3, the checkpoint at step 1 with next tools, the tools node writing the ToolMessage 5 in the checkpoint at step 2 with next model, the second model call with the system prompt and three messages, the reply The sum is 5., the checkpoint at step 3 with no next node, and the return of four messages to your code.',
}, f => {
  lanes.forEach((lane, index) => {
    f.box({ x: cx(index), y: 8, w: 116, h: 40, hue: lane.hue, title: lane.title, sub: lane.sub, titleSize: 11.5, anchor: 'middle', pad: 3 });
    f.lifeline(cx(index), 48, 550);
  });
  rows.forEach(([from, to, style, label, next], index) => {
    const y = 82 + index * 47;
    f.beat(index + 1);
    f.step(16, y, index + 1, { hue: style === 'write' ? 'teal' : undefined });
    const x1 = cx(from);
    const x2 = cx(to);
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label, labelX: style === 'write' ? x2 - 70 : undefined });
    if (next) f.text(x2 - 70, y + 16, next, { size: 11, anchor: 'middle', hue: 'amber', knock: true });
  });
});
