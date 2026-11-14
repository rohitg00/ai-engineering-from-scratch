'use strict';

const fs = require('fs');
const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { flat } = require('../../../_shared/forms.js');

const out = name => fs.readFileSync(path.join(__dirname, '../../capture/out', name), 'utf8');
const block = (text, heading, skip = 0) => {
  let body = text.slice(text.indexOf(heading) + heading.length);
  for (let i = 0; i < skip; i += 1) body = body.slice(body.indexOf('\n]') + 2);
  return JSON.parse(body.slice(body.indexOf('['), body.indexOf('\n]') + 2));
};
const run = out('06-agent-run.txt');
const final = block(run, '## final state', 1);
const calls = block(run, 'model calls seen by the fake:');
const history = out('30-state-history-forks.txt').split('## get_state_history, newest first')[1].split('\n## ')[0];
const checkpoints = history.split(/\n(?=\{)/).filter(chunk => chunk.trim().startsWith('{')).map(chunk => JSON.parse(chunk.slice(0, chunk.lastIndexOf('}') + 1))).reverse();
const call = final[1].tool_calls[0];
const answer = final[3].content;
const system = calls[0].messages[0].split(': ')[1];

const kindOf = message => ({ HumanMessage: ['H', 'violet'], AIMessage: ['AI', 'plum'], ToolMessage: ['T', 'green'] })[message.type];
const nextOf = cp => (cp.next.length ? cp.next.join(', ') : 'none');
const cpRow = i => ({ write: checkpoints[i], label: `put, step ${checkpoints[i].step}`, note: `next: ${nextOf(checkpoints[i])}` });

const lanes = [
  { title: 'your code', sub: 'agent.invoke', hue: 'violet', draw: (f, x) => flat.terminal(f, x, 18, 'violet', { w: 40, h: 34 }) },
  { title: 'model node', sub: 'model', hue: 'indigo', draw: (f, x) => flat.unit(f, x, 22, 'indigo', { w: 34, h: 30 }) },
  { title: 'chat model', sub: calls[0].model, hue: 'plum', draw: (f, x) => flat.tower(f, x, 18, 'plum', { w: 34, h: 34 }) },
  { title: 'tools node', sub: call.name, hue: 'green', draw: (f, x) => flat.unit(f, x, 22, 'green', { w: 34, h: 30 }) },
  { title: 'checkpointer', sub: 'InMemorySaver', hue: 'teal', draw: (f, x) => flat.cylinder(f, x, 14, 'teal', { w: 34, h: 40 }) },
];
const cx = index => 46 + index * 90;
const STATE = 470;

const groups = [
  [[0, 4, 'write', cpRow(0)]],
  [[0, 4, 'write', cpRow(1)]],
  [
    [1, 2, 'model', { label: `call 1: ${calls[0].messages.length} messages` }],
    [2, 1, 'reply', { label: `tool_calls: ${call.name}(${Object.values(call.args).join(', ')})` }],
    [1, 4, 'write', cpRow(2)],
  ],
  [
    [1, 3, 'call', { label: `Send: ${call.name}, ${call.id}` }],
    [3, 4, 'write', { ...cpRow(3), label: `put, step ${checkpoints[3].step}: ${final[2].type} ${final[2].content}` }],
  ],
  [
    [1, 2, 'model', { label: `call 2: ${calls[1].messages.length} messages` }],
    [2, 1, 'reply', { label: answer }],
  ],
  [
    [1, 4, 'write', cpRow(4)],
    [1, 0, 'reply', { label: `${final.length} messages` }],
  ],
];

module.exports = figure('fig-1-2', {
  height: 610,
  title: 'One create_agent run, step by step',
  desc: `Five lifelines under small drawings: your code as a terminal, the model node, the chat model, the tools node, and the checkpointer as a cylinder. A sixth column shows the messages in each checkpoint as chips. Six numbered steps, which match the list in the text: 1, the input checkpoint at step ${checkpoints[0].step} with no messages and next __start__. 2, the checkpoint at step ${checkpoints[1].step} with the human message and next model. 3, the model node calls the chat model with the system prompt "${system}" and the human message, gets a tool call ${call.name} with ${Object.values(call.args).join(' and ')}, and saves step ${checkpoints[2].step} with next tools. 4, the model node sends the tool call to the tools node, which saves step ${checkpoints[3].step} with the ToolMessage for ${call.id} and next model. 5, the second model call gets ${calls[1].messages.length} messages and answers "${answer}". 6, the checkpoint at step ${checkpoints[4].step} has ${final.length} messages and no next node, and invoke returns them.`,
}, f => {
  lanes.forEach((lane, index) => {
    lane.draw(f, cx(index));
    f.text(cx(index), 70, lane.title, { size: 11, weight: 700, hue: lane.hue, anchor: 'middle' });
    f.text(cx(index), 84, lane.sub, { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });
    f.lifeline(cx(index), 92, 572);
  });
  f.kicker(STATE, 70, 'state.messages');
  f.text(STATE, 84, 'in each checkpoint', { size: 11, serif: true, hue: 'ink-soft' });
  f.rule(STATE - 14, 60, STATE - 14, 572, { hue: 'ink-mute', opacity: 0.4 });

  let y = 116;
  let saved = 0;
  groups.forEach((rows, g) => {
    const top = y;
    f.beat(g + 1);
    rows.forEach(([from, to, style, row]) => {
      const x1 = cx(from);
      const x2 = cx(to);
      f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label: row.label, labelX: style === 'write' ? x2 - 76 : undefined });
      if (row.note) f.text(x2 - 76, y + 16, row.note, { size: 11, anchor: 'middle', hue: 'amber', knock: true });
      if (row.write) {
        const count = row.write.messages.length;
        if (!count) f.text(STATE, y + 4, 'empty', { size: 11, serif: true, hue: 'ink-mute' });
        final.slice(0, count).forEach((message, k) => {
          const [mark, hue] = kindOf(message);
          const fresh = k >= saved;
          f.rect(STATE + k * 34, y - 8, 30, 16, { fill: color(fresh ? `${hue}-fill` : 'paper'), stroke: color(`${hue}-ink`), strokeWidth: fresh ? 1.4 : 0.8 });
          f.text(STATE + k * 34 + 15, y + 4, mark, { size: 11, anchor: 'middle', hue, weight: fresh ? 700 : undefined });
        });
        saved = count;
      }
      y += 40;
    });
    f.step(16, top, g + 1, { hue: rows.every(row => row[2] === 'write') ? 'teal' : 'ink' });
    if (rows.length > 1) f.rule(16, top + 10, 16, y - 46, { hue: 'ink-mute' });
    y += 8;
  });
  f.beat(0);
  const legend = [['H', 'violet', 'human'], ['AI', 'plum', 'AIMessage'], ['T', 'green', 'ToolMessage']];
  legend.forEach(([mark, hue, name], i) => {
    const x = 20 + i * 150;
    f.rect(x, 584, 30, 16, { fill: color(`${hue}-fill`), stroke: color(`${hue}-ink`), strokeWidth: 1.4 });
    f.text(x + 15, 596, mark, { size: 11, anchor: 'middle', hue, weight: 700 });
    f.text(x + 38, 596, name, { size: 11, serif: true, hue: 'ink-soft' });
  });
  f.text(STATE, 596, 'bold: new in that step', { size: 11, serif: true, hue: 'ink-soft' });
});
