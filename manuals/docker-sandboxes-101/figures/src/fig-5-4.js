'use strict';

const { figure } = require('../../../_shared/figkit.js');

const lanes = [
  { x: 36, name: 'you, --exec', hue: 'grey' },
  { x: 196, name: 'root', hue: 'violet' },
  { x: 356, name: 'writer', hue: 'violet' },
  { x: 516, name: 'reviewer', hue: 'violet' },
];
const cx = index => lanes[index].x + 50;

const rows = [
  { y: 76, from: 0, to: 1, style: 'call', label: 'Ask the writer for one sentence', note: 'message 1' },
  { y: 126, from: 1, to: 2, style: 'call', label: 'transfer_task', note: 'agent: writer, task, expected_output' },
  { y: 226, from: 2, to: 1, style: 'reply', label: 'MicroVMs are lightweight', note: 'the sentence returns to root' },
  { y: 276, from: 1, to: 3, style: 'state', label: '{"agent": "reviewer"}', note: 'the session moves to reviewer' },
  { y: 326, from: 3, to: 0, style: 'reply', label: 'APPROVED: MicroVMs are lightweight', note: 'answered by reviewer' },
  { y: 376, from: 0, to: 3, style: 'call', label: 'Now hand the conversation to the reviewer.', note: 'message 2' },
  { y: 426, from: 3, to: 0, style: 'reply', label: 'APPROVED: MicroVMs are lightweight', note: 'root is not asked again' },
];

module.exports = figure('fig-5-4', {
  height: 456,
  title: 'A delegation that returns, then a move that stays',
  desc: 'Four lifelines: you running docker-agent run with exec, root, writer, and reviewer from capture/fixtures/agents/team.yaml. Message 1 asks root for one sentence from the writer. Root calls transfer_task with agent writer, a task and an expected output, the writer runs in its own sub-session that holds only the task, and its sentence, MicroVMs are lightweight virtual machines, returns to root as the tool response. Root then calls the session-moving tool with agent reviewer, and reviewer answers APPROVED with the sentence. Message 2 goes straight to reviewer, which answers the same way, and root is not asked again.',
}, f => {
  for (const lane of lanes) {
    f.box({ x: lane.x, y: 10, w: 100, h: 30, hue: lane.hue, title: lane.name, titleSize: 11.5 });
    f.lifeline(lane.x + 50, 40, 444);
  }
  rows.forEach((row, index) => {
    f.beat(index + 1);
    f.step(18, row.y, index + 1, { hue: row.style === 'state' ? 'amber' : undefined });
    const x1 = cx(row.from);
    const x2 = cx(row.to);
    f.arrow([x1, row.y], [x2 + (x2 > x1 ? -1 : 1), row.y], { style: row.style, label: row.label, note: row.note });
    if (index === 1) f.box({ x: 351, y: 150, w: 110, h: 46, hue: 'amber', title: 'sub-session', titleSize: 12, sub: ['task only'] });
  });
});
