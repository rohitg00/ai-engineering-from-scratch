'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/kagent-turns-x86.json'));
const seconds = value => `${value.toFixed(3)} s`;
const columns = [
  { name: 'resume', runs: data.runs.resume_seconds_turns_only, stat: data.resume_seconds.turns_only, hue: 'amber' },
  { name: 'suspend', runs: data.runs.suspend_seconds, stat: data.suspend_seconds, hue: 'amber' },
  { name: 'turn, 4 s apart', runs: data.runs.server_turn_seconds['A-spaced'], stat: data.server_turn_seconds['A-spaced'], hue: 'plum' },
  { name: 'turn, no pause', runs: data.runs.server_turn_seconds['B-b2b'], stat: data.server_turn_seconds['B-b2b'], hue: 'plum' },
  { name: 'first turn', runs: data.runs.server_turn_seconds['C-first'], stat: data.server_turn_seconds['C-first'], hue: 'plum' },
];
const HALF = 40;

function ranked(values, py) {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted.map((value, index) => ({ dx: -HALF + (2 * HALF * index) / (sorted.length - 1), y: py(value) }));
}

module.exports = figure('fig-7-1b', {
  height: 356,
  title: 'A kagent turn costs the same with a pause and with no pause',
  desc: `Every run of our kagent test with a mock model, as one dot each, with the median as a line. Resume ${seconds(columns[0].stat.median)} over ${columns[0].stat.n} turns, suspend ${seconds(columns[1].stat.median)} over ${columns[1].stat.n} suspends, a turn 4 seconds after the last one ${seconds(columns[2].stat.median)}, a turn with no pause ${seconds(columns[3].stat.median)}, and the first turn of a new Session ${seconds(columns[4].stat.median)}.`,
}, f => {
  const c = chart(f, { x: 62, y: 64, w: 548, h: 220, xDomain: [0, columns.length], yDomain: [0, 1.1], yTicks: [0, 0.25, 0.5, 0.75, 1], yLabel: 'seconds for each run, with a mock model' });
  f.kicker(c.px(1), 24, 'state changes inside a turn', { hue: 'amber', anchor: 'middle' });
  f.kicker(c.px(3.5), 24, 'the whole turn, in the cluster', { hue: 'plum', anchor: 'middle' });
  f.rule(c.px(2), 64, c.px(2), 284, { hue: 'ink-mute', dash: 'dashed', opacity: 0.6 });
  columns.forEach((column, index) => {
    const cx = c.px(index + 0.5);
    const my = c.py(column.stat.median);
    f.rule(cx - HALF - 8, my, cx + HALF + 8, my, { hue: 'ink', width: 1.4 });
    for (const dot of ranked(column.runs, c.py)) f.dot(cx + dot.dx, dot.y, { hue: column.hue, r: 1.8 });
    f.text(cx, c.py(column.stat.max) - 9, seconds(column.stat.median), { size: 12, weight: 700, hue: column.hue, anchor: 'middle', knock: true });
    f.text(cx, 302, column.name, { size: 11, anchor: 'middle' });
    f.text(cx, 317, `${column.stat.n} runs`, { size: 11, anchor: 'middle', serif: true, hue: 'ink-soft' });
  });
  const apart = Math.abs(columns[3].stat.median - columns[2].stat.median).toFixed(3);
  const by = c.py(0.93);
  f.path(`M${c.px(2.5)} ${by + 5} V${by} H${c.px(3.5)} V${by + 5}`, { hue: 'plum', head: false, packet: false });
  f.text(c.px(3), by - 6, `no warm turn: ${apart} s apart`, { size: 11, serif: true, anchor: 'middle', hue: 'plum', knock: true });
  f.text(62, 344, 'one dot: one run, sorted from the fastest to the slowest. black line: the median.', { size: 11, serif: true, hue: 'ink-soft' });
});
