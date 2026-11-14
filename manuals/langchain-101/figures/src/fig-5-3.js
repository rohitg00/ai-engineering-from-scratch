'use strict';

const { figure } = require('../../../_shared/figkit.js');

const lanes = [
  { title: 'your code', sub: 'invoke', hue: 'violet' },
  { title: 'workflow', sub: '@entrypoint', hue: 'indigo' },
  { title: 'double', sub: '@task', hue: 'indigo' },
  { title: 'ask_human', sub: '@task', hue: 'indigo' },
  { title: 'checkpointer', sub: 'InMemorySaver', hue: 'teal' },
];
const cx = index => 64 + index * 128;

const rows = [
  [0, 1, 'call', 'invoke([1, 2, 3])'],
  [1, 2, 'model', 'double(1), (2), (3) run'],
  [2, 4, 'write', 'results 2, 4, 6'],
  [1, 3, 'call', 'ask_human(12)'],
  [3, 0, 'state', 'interrupt: Keep it?'],
  null,
  [0, 1, 'call', "Command(resume='yes')"],
  [1, 2, 'call', 'double(1), (2), (3)'],
  [4, 2, 'reply', 'saved 2, 4, 6'],
  [2, 1, 'reply', '2, 4, 6, no body runs'],
  [1, 3, 'call', 'ask_human(12)'],
  [3, 1, 'reply', "'yes'"],
  [1, 0, 'reply', 'total 12, answer yes'],
];

module.exports = figure('fig-5-3', {
  height: 640,
  title: 'Two runs of one entrypoint',
  desc: 'Five lifelines: your code, the workflow entrypoint, the double task, the ask_human task, and the checkpointer. Run 1: invoke with 1, 2, 3 runs the bodies of double three times, saves the results 2, 4, and 6, calls ask_human with 12, and stops with the interrupt Keep it. Run 2: Command resume yes runs workflow again from its top. The double calls return the saved results 2, 4, and 6 and no body runs. ask_human gets yes, and workflow returns total 12 and answer yes.',
}, f => {
  lanes.forEach((lane, index) => {
    f.box({ x: cx(index), y: 8, w: 116, h: 40, hue: lane.hue, title: lane.title, sub: lane.sub, titleSize: 11.5, anchor: 'middle', pad: 3 });
    f.lifeline(cx(index), 48, 630);
  });
  f.text(20, 70, 'RUN 1', { size: 11, spacing: 1.2, hue: 'ink-mute', knock: true });
  let n = 0;
  rows.forEach((row, index) => {
    const y = 92 + index * 42;
    if (!row) {
      f.rule(20, y - 4, 620, y - 4, { hue: 'ink-mute', dash: 'dashed' });
      f.text(20, y + 12, 'RUN 2, THE RESUME', { size: 11, spacing: 1.2, hue: 'ink-mute', knock: true });
      return;
    }
    const [from, to, style, label] = row;
    n += 1;
    f.beat(n);
    f.step(16, y, n, { hue: style === 'write' ? 'teal' : style === 'state' ? 'amber' : undefined });
    const x1 = cx(from);
    const x2 = cx(to);
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label });
  });
});
