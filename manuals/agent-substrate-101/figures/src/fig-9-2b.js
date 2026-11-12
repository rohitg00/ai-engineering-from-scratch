'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const agent = load(path.join(__dirname, '../../capture/lab/summary/demos-x86.json')).stateful_agent;
const groups = [
  { label: 'running actor', kind: 'memory', phase: 'warm', hue: 'green' },
  { label: 'running actor', kind: 'volumes', phase: 'warm', hue: 'teal' },
  { label: 'after a suspend', kind: 'memory', phase: 'resumed', hue: 'green' },
  { label: 'after a suspend', kind: 'volumes', phase: 'resumed', hue: 'teal' },
].map(group => ({ ...group, values: agent[group.kind].turns.filter(turn => turn.phase === group.phase).map(turn => turn.seconds) }));
const TOP = 36;
const BOTTOM = 256;
const MAX = 6;
const py = seconds => BOTTOM - (seconds / MAX) * (BOTTOM - TOP);
const xs = [140, 270, 420, 540];
const two = value => value.toFixed(2);
const range = values => `${two(Math.min(...values))} to ${two(Math.max(...values))} s`;

module.exports = figure('fig-9-2b', {
  height: 318,
  title: 'The time of one agent turn, by fidelity and by the state of the actor',
  desc: `Seconds for one turn of the agent at the client, on the second x86 server guest with a mock model. On a running actor a turn took ${range(groups[0].values)} under memory fidelity and ${range(groups[1].values)} under volumes fidelity, with ${groups[0].values.length} turns each. After a suspend a turn took ${range(groups[2].values)} under memory fidelity and ${range(groups[3].values)} under volumes fidelity, with ${groups[2].values.length} turns each.`,
}, f => {
  for (let s = 0; s <= MAX; s += 1) {
    f.rule(70, py(s), 600, py(s), { hue: 'ink-mute', opacity: s === 0 ? 1 : 0.2 });
    f.text(60, py(s) + 4, String(s), { size: 11, anchor: 'end', hue: 'ink-soft' });
  }
  f.text(70, 22, 'seconds for one turn, at the client', { size: 11.5, serif: true, hue: 'ink-soft' });
  groups.forEach((group, index) => {
    const x = xs[index];
    group.values.forEach((value, n) => f.dot(x + (n - (group.values.length - 1) / 2) * 9, py(value), { hue: group.hue, r: 3.4 }));
    const top = py(Math.max(...group.values));
    f.text(x, top - 24, `${group.kind} fidelity`, { size: 11.5, weight: 700, hue: group.hue, anchor: 'middle', knock: true });
    f.text(x, top - 10, range(group.values), { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle', knock: true });
  });
  f.text(205, BOTTOM + 20, 'a turn on a running actor', { size: 12, weight: 700, anchor: 'middle' });
  f.text(480, BOTTOM + 20, 'a turn that resumes the actor', { size: 12, weight: 700, anchor: 'middle' });
  f.text(205, BOTTOM + 36, `${groups[0].values.length} turns for each fidelity`, { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });
  f.text(480, BOTTOM + 36, `${groups[2].values.length} turns for each fidelity`, { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });
});
