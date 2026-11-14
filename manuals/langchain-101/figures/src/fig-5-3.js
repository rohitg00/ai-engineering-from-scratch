'use strict';

const fs = require('fs');
const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');

const text = fs.readFileSync(path.join(__dirname, '../../capture/out/35-functional-api.txt'), 'utf8');
const json = (heading, open = '[', from = 0) => {
  const at = text.indexOf(open, text.indexOf(heading, from));
  return JSON.parse(text.slice(at, text.indexOf(`\n${open === '[' ? ']' : '}'}`, at) + 2));
};
const first = json('## first run stops at the interrupt inside a task', '{');
const pause = first.interrupts[0].value;
const runsAfterFirst = json('task runs:', '[', text.indexOf('## first run'));
const resumeAt = text.indexOf('## resume: finished tasks are not run again');
const final = json('## resume', '{', resumeAt);
const runsAfterResume = json('task runs:', '[', resumeAt);
const results = runsAfterFirst.map(call => 2 * Number(/\((\d+)\)/.exec(call)[1]));
if (results.reduce((a, b) => a + b, 0) !== pause.total) throw new Error('fig-5-3: the doubled inputs do not add up to the interrupt total');
const fresh = runsAfterResume.length - runsAfterFirst.length;
const inputs = runsAfterFirst.map(call => /\((\d+)\)/.exec(call)[1]);

const lanes = [
  { title: 'your code', sub: 'invoke', hue: 'violet' },
  { title: 'workflow', sub: '@entrypoint', hue: 'indigo' },
  { title: 'double', sub: '@task', hue: 'indigo' },
  { title: 'ask_human', sub: '@task', hue: 'indigo' },
  { title: 'checkpointer', sub: 'InMemorySaver', hue: 'teal' },
];
const cx = index => 46 + index * 86;
const LOG = 446;

const rows = [
  [0, 1, 'call', `invoke([${inputs.join(', ')}])`],
  [1, 2, 'call', `double(${inputs.join('), (')})`, 'runs'],
  [2, 4, 'write', `results ${results.join(', ')}`],
  [1, 3, 'call', `ask_human(${pause.total})`],
  [3, 0, 'state', `interrupt: ${pause.question}`],
  null,
  [0, 1, 'call', `Command(resume='${final.answer}')`],
  [1, 2, 'call', `double(${inputs.join('), (')})`, 'none'],
  [4, 2, 'reply', `saved ${results.join(', ')}`],
  [2, 1, 'reply', `${results.join(', ')}, no body runs`],
  [1, 3, 'call', `ask_human(${pause.total})`],
  [3, 1, 'reply', `'${final.answer}'`],
  [1, 0, 'reply', `total ${final.total}, answer ${final.answer}`],
];

module.exports = figure('fig-5-3', {
  height: 650,
  title: 'Two runs of one entrypoint',
  desc: `Five lifelines: your code, the workflow entrypoint, the double task, the ask_human task, and the checkpointer. A sixth column is the log of task bodies that ran, read from the capture. Run 1: invoke with ${inputs.join(', ')} runs the bodies ${runsAfterFirst.join(', ')}, saves the results ${results.join(', ')}, calls ask_human with ${pause.total}, and stops with the interrupt "${pause.question}". Run 2: Command resume ${final.answer} runs workflow again from its top. The double calls return the saved results and the log gets ${fresh} new entries. ask_human gets ${final.answer}, and workflow returns total ${final.total} and answer ${final.answer}.`,
}, f => {
  lanes.forEach((lane, index) => {
    f.box({ x: cx(index), y: 8, w: 84, h: 40, hue: lane.hue, title: lane.title, sub: lane.sub, titleSize: 11, anchor: 'middle', pad: 2 });
    f.lifeline(cx(index), 48, 640);
  });
  f.kicker(LOG, 22, 'task bodies run');
  f.text(LOG, 38, 'the log, in order', { size: 11, serif: true, hue: 'ink-soft' });
  f.rule(LOG - 12, 8, LOG - 12, 640, { hue: 'ink-mute', opacity: 0.4 });
  f.text(20, 70, 'RUN 1', { size: 11, spacing: 1.2, hue: 'ink-mute', knock: true });
  let n = 0;
  rows.forEach((row, index) => {
    const y = 92 + index * 42;
    if (!row) {
      f.rule(20, y - 4, LOG - 20, y - 4, { hue: 'ink-mute', dash: 'dashed' });
      f.text(20, y + 12, 'RUN 2, THE RESUME', { size: 11, spacing: 1.2, hue: 'ink-mute', knock: true });
      return;
    }
    const [from, to, style, label, log] = row;
    n += 1;
    f.beat(n);
    f.step(16, y, n, { hue: style === 'write' ? 'teal' : style === 'state' ? 'amber' : undefined });
    const x1 = cx(from);
    const x2 = cx(to);
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label, labelX: /^(Command|total)/.test(label) ? 128 : undefined });
    if (log === 'runs') runsAfterFirst.forEach((call, k) => {
      f.rect(LOG + k * 64, y - 10, 64, 20, { fill: color('indigo-fill'), stroke: color('indigo-ink') });
      f.text(LOG + k * 64 + 32, y + 4, call, { size: 11, anchor: 'middle', hue: 'indigo' });
    });
    if (log === 'none') {
      f.rect(LOG, y - 10, 182, 20, { fill: color('paper'), stroke: color('teal-ink'), dash: 'dashed' });
      f.text(LOG + 8, y + 4, `${fresh} new entries`, { size: 11, hue: 'teal', weight: 700 });
    }
  });
  f.beat(0);
  f.text(LOG, 610, `${runsAfterResume.length} entries after both runs:`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(LOG, 626, 'each double body ran once', { size: 11, serif: true, hue: 'teal', weight: 700 });
});
