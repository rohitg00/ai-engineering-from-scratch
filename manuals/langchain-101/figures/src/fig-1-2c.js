'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const S = load(path.join(__dirname, '../../capture/lab/summary/multiagent-mac.json')).n9;
if (!S || S.n_common < 30) throw new Error('fig-1-2c: the Deep Agents and Agent SDK runs do not cover 30 tasks');
const SIDES = [['deep_agent', 'Deep Agents', 'blue'], ['claude_agent_sdk', 'Claude Agent SDK', 'olive']].map(([k, name, hue]) => {
  const s = S[k];
  const ids = Object.keys(s.tasks);
  return { k, name, hue, s, perTask: ids.map(t => s.tasks[t].in / 1000) };
});
const COLS = [
  { title: ['tasks passed', 'of 30'], max: 30, v: s => s.pass, fmt: v => `${v}` },
  { title: ['model calls', 'per task'], max: 10, v: s => s.calls_med, fmt: v => `${v}` },
  { title: ['input tokens', 'per task'], max: Math.ceil(Math.max(...SIDES.map(x => x.s.in_med)) / 10000) * 10, v: s => s.in_med / 1000, fmt: v => `${v.toFixed(1)}k` },
  { title: ['dollars', 'for 30 tasks'], max: 0.02, v: s => s.cost_sum, fmt: v => `$${v.toFixed(4)}` },
];
const X0 = 168;
const CW = 104;

module.exports = figure('fig-1-2c', {
  height: 236,
  title: 'Deep Agents and the Claude Agent SDK on the same 30 tasks',
  desc: `A dot table for Claude Haiku 5.5 with the same tools and the same system prompt in both harnesses. ${SIDES.map(x => `${x.name}: ${x.s.pass} of ${x.s.n} passed, a median of ${x.s.calls_med} model calls and ${(x.s.in_med / 1000).toFixed(1)}k input tokens per task, $${x.s.cost_sum.toFixed(4)} for all tasks`).join('; ')}. The two harnesses agreed on ${S.agree} of ${S.n_common} task outcomes. Below, each dot is the input tokens of one task.`,
}, f => {
  COLS.forEach((c, i) => {
    const x = X0 + i * (CW + 14);
    f.kicker(x, 22, c.title[0]);
    f.kicker(x, 38, c.title[1]);
  });
  SIDES.forEach((side, r) => {
    f.beat(r + 1);
    const y = 62 + r * 30;
    f.text(16, y + 4, side.name, { size: 12, weight: 700, hue: side.hue });
    COLS.forEach((c, i) => {
      const x = X0 + i * (CW + 14);
      const v = c.v(side.s);
      f.rule(x, y, x + CW, y, { hue: 'ink-mute', opacity: 0.3 });
      const cx = x + Math.min(1, v / c.max) * CW;
      f.dot(cx, y, { r: 4.5, hue: side.hue });
      const label = c.fmt(v);
      const right = cx + 8 + label.length * 6.6 < x + CW + 12;
      f.text(right ? cx + 8 : cx - 8, y - 8, label, { size: 11, anchor: right ? 'start' : 'end' });
    });
  });
  f.beat(3);
  const top = 138;
  const left = X0;
  const width = 4 * CW + 3 * 14;
  const max = Math.ceil(Math.max(...SIDES.flatMap(x => x.perTask)) / 20) * 20;
  f.kicker(16, top + 4, 'input tokens');
  f.kicker(16, top + 20, 'per task');
  SIDES.forEach((side, r) => {
    const y = top + r * 22;
    f.rule(left, y, left + width, y, { hue: 'ink-mute', opacity: 0.3 });
    side.perTask.slice().sort((a, b) => a - b).forEach((v, k) => {
      f.dot(left + Math.min(1, v / max) * width, y + ((k % 3) - 1) * 3, { r: 2.2, hue: side.hue });
    });
  });
  const ay = top + 52;
  f.rule(left, ay, left + width, ay, { hue: 'ink' });
  for (let t = 0; t <= max; t += 10) {
    const tx = left + (t / max) * width;
    f.rule(tx, ay, tx, ay + 4, { hue: 'ink' });
    f.text(tx, ay + 17, `${t}k`, { size: 11, anchor: 'middle', hue: 'ink-soft' });
  }
});
