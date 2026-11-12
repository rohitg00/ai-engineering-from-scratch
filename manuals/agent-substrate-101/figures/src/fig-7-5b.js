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
const firsts = [
  { name: 'no repo', value: data.first_resume.no_workspace, hue: 'green' },
  { name: 'blocked', value: data.first_resume.workspace_clone_blocked, hue: 'rose' },
  { name: '2nd resume', value: data.first_resume.workspace_clone_blocked_second, hue: 'rose' },
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
  title: 'Agent Executor commands on a task with no workspace, and the first resume',
  desc: `Two charts from one run with no model. On the left, every run of ${columns[0].stat.n} cycles on one task with no workspace, one dot each: ax suspend task took a median of ${seconds(columns[0].stat.median)}, ax resume task ${seconds(columns[1].stat.median)}, and one command through ax ssh ${seconds(columns[2].stat.median)}. On the right, one run each of the first ax resume task: ${seconds(firsts[0].value)} for a task with no workspace, ${seconds(firsts[1].value)} for a task whose Git clone was blocked, and ${seconds(firsts[2].value)} for the next resume of that task, which tried the clone again.`,
}, f => {
  const left = chart(f, { x: 56, y: TOP, w: 270, h: HEIGHT, xDomain: [0, columns.length], yDomain: [0, 1], yTicks: [0, 0.25, 0.5, 0.75, 1], xLabel: 'ax command, 10 runs each', yLabel: 'seconds at the client, each run' });
  const right = chart(f, { x: 380, y: TOP, w: 234, h: HEIGHT, xDomain: [0, firsts.length], yDomain: [0, 14], yTicks: [0, 2, 4, 6, 8, 10, 12, 14], xLabel: 'Git clone when the task starts', yLabel: 'seconds, one run each' });
  f.kicker(left.px(1.5), 24, 'after the first resume', { hue: 'amber', anchor: 'middle' });
  f.kicker(right.px(1.5), 24, 'resume with a start to wait for', { hue: 'rose', anchor: 'middle' });
  columns.forEach((column, index) => {
    const cx = left.px(index + 0.5);
    const my = left.py(column.stat.median);
    f.rule(cx - HALF - 8, my, cx + HALF + 8, my, { hue: 'ink', width: 1.4 });
    for (const dot of ranked(column.runs, left.py)) f.dot(cx + dot.dx, dot.y, { hue: column.hue, r: 2.2 });
    f.text(cx, left.py(column.stat.max) - 10, seconds(column.stat.median), { size: 12, weight: 700, hue: column.hue, anchor: 'middle', knock: true });
    f.text(cx, TOP + HEIGHT + 18, column.name, { size: 11, anchor: 'middle' });
  });
  firsts.forEach((first, index) => {
    const cx = right.px(index + 0.5);
    const top = right.py(first.value);
    f.rect(cx - 18, top, 36, right.py(0) - top, { hue: first.hue });
    f.text(cx, top - 8, seconds(first.value), { size: 12, weight: 700, hue: first.hue, anchor: 'middle', knock: true });
    f.text(cx, TOP + HEIGHT + 18, first.name, { size: 11, anchor: 'middle' });
  });
  f.text(56, 336, 'one dot: one run. black line: the median. Every task ran sleep infinity, with no model.', { size: 11, serif: true, hue: 'ink-soft' });
});
