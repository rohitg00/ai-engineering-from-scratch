'use strict';

const { figure } = require('../../../_shared/figkit.js');

const lanes = [
  { title: 'your code', sub: 'invoke', hue: 'violet' },
  { title: 'graph', sub: 'Pregel loop', hue: 'indigo' },
  { title: 'write', sub: 'node', hue: 'indigo' },
  { title: 'review', sub: 'node', hue: 'indigo' },
  { title: 'checkpointer', sub: 'InMemorySaver', hue: 'teal' },
];
const cx = index => 64 + index * 128;

const rows = [
  [0, 1, 'call', 'invoke(input)', null],
  [1, 2, 'call', 'run write', 'draft set'],
  [1, 3, 'call', 'run review', 'line before interrupt'],
  [3, 4, 'write', 'pause saved', 'next: review'],
  [1, 0, 'state', 'interrupt: Approve this draft?', null],
  null,
  [0, 1, 'call', "Command(resume='yes')", null],
  [1, 3, 'call', 'run review again', 'line before interrupt'],
  [3, 1, 'reply', 'verdict: approved', 'line after interrupt'],
  [1, 4, 'write', 'step saved', 'next: none'],
  [1, 0, 'reply', 'final state', null],
];

module.exports = figure('fig-5-4', {
  height: 600,
  title: 'One interrupt and one resume',
  desc: 'Five lifelines: your code, the graph loop, the write node, the review node, and the checkpointer. The first invoke runs write, then review up to its interrupt, saves the pause with next review, and returns the interrupt Approve this draft. The resume with Command resume yes runs review again from its first line, so the line before the interrupt runs a second time, then the line after it, and the verdict approved is saved. write does not run again.',
}, f => {
  lanes.forEach((lane, index) => {
    f.box({ x: cx(index), y: 8, w: 116, h: 40, hue: lane.hue, title: lane.title, sub: lane.sub, titleSize: 11.5, anchor: 'middle', pad: 3 });
    f.lifeline(cx(index), 48, 590);
  });
  f.text(20, 70, 'INVOKE', { size: 11, spacing: 1.2, hue: 'ink-mute', knock: true });
  let n = 0;
  rows.forEach((row, index) => {
    const y = 92 + index * 44;
    if (!row) {
      f.rule(20, y - 4, 620, y - 4, { hue: 'ink-mute', dash: 'dashed' });
      f.text(20, y + 12, 'THE RESUME', { size: 11, spacing: 1.2, hue: 'ink-mute', knock: true });
      f.text(cx(2), y + 12, 'write does not run', { size: 11, anchor: 'middle', serif: true, hue: 'ink-soft', knock: true });
      return;
    }
    const [from, to, style, label, note] = row;
    n += 1;
    f.beat(n);
    f.step(16, y, n, { hue: style === 'write' ? 'teal' : style === 'state' ? 'amber' : undefined });
    const x1 = cx(from);
    const x2 = cx(to);
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label, labelX: style === 'state' ? 214 : undefined });
    if (note) f.text((x1 + x2) / 2, y + 15, note, { size: 11, anchor: 'middle', serif: true, hue: style === 'write' ? 'amber' : 'ink-soft', knock: true });
  });
});
