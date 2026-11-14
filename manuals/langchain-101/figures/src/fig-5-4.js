'use strict';

const fs = require('fs');
const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');

const text = fs.readFileSync(path.join(__dirname, '../../capture/out/32-interrupt-resume.txt'), 'utf8');
const json = (heading, open = '[') => {
  const at = text.indexOf(open, text.indexOf(heading));
  return JSON.parse(text.slice(at, text.indexOf(`\n${open === '[' ? ']' : '}'}`, at) + 2));
};
const pause = json('## interrupt() pauses the run')[0].value;
const next = json('state:', '{').next;
const value = json('value:', '{');
const runs = json('node runs:');
const [writeNode, reviewNode] = [runs[0], runs[1].split(' ')[0]];
const resume = /Command\(resume='([^']+)'\)/.exec(text)[1];
const repeated = runs.filter(line => line === runs[1]).length;

const lanes = [
  { title: 'your code', sub: 'invoke', hue: 'violet' },
  { title: 'graph', sub: 'Pregel loop', hue: 'indigo' },
  { title: writeNode, sub: 'node', hue: 'indigo' },
  { title: reviewNode, sub: 'node', hue: 'indigo' },
  { title: 'checkpointer', sub: 'InMemorySaver', hue: 'teal' },
];
const cx = index => 46 + index * 86;
const LOG = 446;

const rows = [
  [0, 1, 'call', 'invoke(input)'],
  [1, 2, 'call', `run ${writeNode}`, 0],
  [1, 3, 'call', `run ${reviewNode}`, 1],
  [3, 4, 'write', 'pause saved', null, `next: ${next.join(', ')}`],
  [1, 0, 'state', `interrupt: ${pause.question}`],
  null,
  [0, 1, 'call', `Command(resume='${resume}')`],
  [1, 3, 'call', `run ${reviewNode} again`, 2],
  [3, 1, 'reply', `verdict: ${value.verdict}`, 3],
  [1, 4, 'write', 'step saved', null, 'next: none'],
  [1, 0, 'reply', 'final state'],
];

module.exports = figure('fig-5-4', {
  height: 600,
  title: 'One interrupt and one resume',
  desc: `Five lifelines: your code, the graph loop, the ${writeNode} node, the ${reviewNode} node, and the checkpointer. A sixth column is the log of node bodies that ran, in order, from the capture. The first invoke runs ${writeNode}, then ${reviewNode} up to its interrupt, saves the pause with next ${next.join(', ')}, and returns the interrupt "${pause.question}". The resume with Command resume ${resume} runs ${reviewNode} again from its first line. The log shows "${runs[1]}" ${repeated} times, then "${runs[3]}", and the verdict ${value.verdict} is saved. ${writeNode} does not run again.`,
}, f => {
  lanes.forEach((lane, index) => {
    f.box({ x: cx(index), y: 8, w: 84, h: 40, hue: lane.hue, title: lane.title, sub: lane.sub, titleSize: 11, anchor: 'middle', pad: 2 });
    f.lifeline(cx(index), 48, 590);
  });
  f.kicker(LOG, 22, 'node bodies run');
  f.text(LOG, 38, 'the log, in order', { size: 11, serif: true, hue: 'ink-soft' });
  f.rule(LOG - 12, 8, LOG - 12, 590, { hue: 'ink-mute', opacity: 0.4 });
  f.text(20, 70, 'INVOKE', { size: 11, spacing: 1.2, hue: 'ink-mute', knock: true });
  let n = 0;
  rows.forEach((row, index) => {
    const y = 92 + index * 44;
    if (!row) {
      f.rule(20, y - 4, LOG - 20, y - 4, { hue: 'ink-mute', dash: 'dashed' });
      f.text(20, y + 12, 'THE RESUME', { size: 11, spacing: 1.2, hue: 'ink-mute', knock: true });
      f.text(cx(2), y + 12, `${writeNode} does not run`, { size: 11, anchor: 'middle', serif: true, hue: 'ink-soft', knock: true });
      return;
    }
    const [from, to, style, label, log, note] = row;
    n += 1;
    f.beat(n);
    f.step(16, y, n, { hue: style === 'write' ? 'teal' : style === 'state' ? 'amber' : undefined });
    const x1 = cx(from);
    const x2 = cx(to);
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label, labelX: style === 'state' ? cx(2) : label.startsWith('Command') ? 122 : undefined });
    if (note) f.text((x1 + x2) / 2, y + 15, note, { size: 11, anchor: 'middle', hue: 'amber', knock: true });
    if (log !== undefined && log !== null) {
      const again = log > 1 && runs[log] === runs[1];
      f.rect(LOG, y - 10, 188, 20, { fill: color(again ? 'rose-fill' : 'indigo-fill'), stroke: color(again ? 'rose-ink' : 'indigo-ink'), dash: again ? 'dashed' : undefined });
      f.text(LOG + 6, y + 4, runs[log], { size: 11, hue: again ? 'rose' : 'indigo', max: 180 });
    }
  });
  f.beat(0);
  f.text(LOG, 574, `"${runs[1]}"`, { size: 11, serif: true, hue: 'rose' });
  f.text(LOG, 588, `ran ${repeated} times`, { size: 11, serif: true, hue: 'rose', weight: 700 });
});
