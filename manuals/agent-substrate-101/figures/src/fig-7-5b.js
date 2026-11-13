'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/agent-executor-x86.json'));
const seconds = value => `${value.toFixed(2)} s`;
const columns = [
  { name: 'suspend', key: 'suspend', hue: 'amber' },
  { name: 'resume', key: 'resume', hue: 'amber' },
  { name: 'ssh, 1 command', key: 'ssh', hue: 'plum' },
].map(column => ({ ...column, runs: data.cycles.runs[column.key], stat: data.cycles.seconds[column.key] }));
const more = load(path.join(__dirname, '../../capture/lab/summary/agent-executor-followups-x86.json'));
const refused = more.clone.resume_with_https_rule;
const kept = more.clone.resume_after_clone;
const firsts = [
  { name: 'no workspace', note: '1 run', value: data.first_resume.no_workspace, hue: 'green' },
  { name: 'clone, no egress rule', note: '1 run, 5 tries fail', value: data.first_resume.workspace_clone_blocked, hue: 'rose' },
  { name: 'clone, https rule', note: `median of ${refused.seconds.n}, 5 tries fail`, value: refused.seconds.median, hue: 'rose' },
  { name: 'clone, tlsPassthrough rule', note: '1 run, the clone works', value: more.clone.resume_with_passthrough_rule_seconds, hue: 'violet' },
  { name: 'next resumes, checkout kept', note: `median of ${kept.seconds.n}`, value: kept.seconds.median, hue: 'green' },
];
const HALF = 34;
const TOP = 64;
const HEIGHT = 210;

function ranked(values, py) {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted.map((value, index) => ({ dx: -HALF + (2 * HALF * index) / (sorted.length - 1), y: py(value) }));
}

module.exports = figure('fig-7-5b', {
  height: 346,
  title: 'Agent Executor commands on a task with no workspace, and the resume of a task that clones',
  desc: `Two charts from our runs of one Agent Executor commit. On the left, every run of ${columns[0].stat.n} cycles on one task with no workspace, one dot each: ax suspend task took a median of ${seconds(columns[0].stat.median)}, ax resume task ${seconds(columns[1].stat.median)}, and one command through ax ssh ${seconds(columns[2].stat.median)}. On the right, the time of ax resume task when the runner prepares a workspace: ${seconds(firsts[0].value)} with no workspace, ${seconds(firsts[1].value)} when the clone has no egress rule, a median of ${seconds(firsts[2].value)} over ${refused.seconds.n} resumes when an https rule lets the gateway intercept TLS and git refuses the certificate, ${seconds(firsts[3].value)} when a tlsPassthrough rule lets the clone work, and a median of ${seconds(firsts[4].value)} for the next resumes, which keep the checkout. The long resumes are five tries of the runner, and not the cost of a resume.`,
}, f => {
  const left = chart(f, { x: 56, y: TOP, w: 250, h: HEIGHT, xDomain: [0, columns.length], yDomain: [0, 1], yTicks: [0, 0.25, 0.5, 0.75, 1], xLabel: 'ax command, 10 runs each', yLabel: 'seconds at the client, each run' });
  f.kicker(left.px(1.5), 24, 'after the first resume', { hue: 'amber', anchor: 'middle' });
  f.kicker(360, 24, 'ax resume task, with a workspace', { hue: 'rose' });
  columns.forEach((column, index) => {
    const cx = left.px(index + 0.5);
    const my = left.py(column.stat.median);
    f.rule(cx - HALF - 8, my, cx + HALF + 8, my, { hue: 'ink', width: 1.4 });
    for (const dot of ranked(column.runs, left.py)) f.dot(cx + dot.dx, dot.y, { hue: column.hue, r: 2.2 });
    f.text(cx, left.py(column.stat.max) - 10, seconds(column.stat.median), { size: 12, weight: 700, hue: column.hue, anchor: 'middle', knock: true });
    f.text(cx, TOP + HEIGHT + 18, column.name, { size: 11, anchor: 'middle' });
  });
  const scale = 190 / 14;
  f.rule(360, 46, 360, 46 + firsts.length * 50, { hue: 'ink' });
  firsts.forEach((first, index) => {
    const y = 58 + index * 50;
    const width = Math.max(first.value * scale, 2);
    f.text(366, y, first.name, { size: 11 });
    f.rect(360, y + 7, width, 12, { hue: first.hue });
    f.text(360 + width + 6, y + 17, seconds(first.value), { size: 12, weight: 700, hue: first.hue });
    f.text(366, y + 33, first.note, { size: 11, serif: true, hue: 'ink-soft' });
  });
  f.text(56, 336, 'one dot: one run. black line: the median. Every task ran sleep infinity.', { size: 11, serif: true, hue: 'ink-soft' });
});
