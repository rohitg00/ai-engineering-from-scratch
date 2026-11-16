'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const S = load(path.join(__dirname, '../../capture/lab/bench/summary-mac.json'));
const ST = S.structured;
const Q4 = 'qwen3:4b-instruct-2507-q4_K_M';
const ROWS = [
  [Q4, 'Qwen3 4B', ['none', 'tool', 'provider', 'extract']],
  ['qwen3:8b', 'Qwen3 8B', ['none', 'tool', 'extract']],
  ['claude-haiku-5-5', 'Haiku 5.5', ['none', 'tool', 'provider', 'extract']],
];
const VAR = { none: 'free text', tool: 'ToolStrategy', provider: 'ProviderStrategy', extract: 'extract call' };
const cell = (m, v) => {
  const c = ST.cells[`${m}|${v}`];
  if (!c) throw new Error(`fig-4-3: no cell ${m} ${v}`);
  return c;
};
const order = ST.order;
const X0 = 226;
const CW = 8.4;
const colX = {};
let x = X0;
order.forEach((t, i) => {
  if (i && t.startsWith('sql') && order[i - 1].startsWith('chain')) x += 8;
  colX[t] = x;
  x += CW;
});
const chainEnd = colX[order.filter(t => t.startsWith('chain')).pop()] + CW;
const sqlStart = colX[order.find(t => t.startsWith('sql'))];
const XEND = x;
const RH = 17;
const Y0 = 62;
const SEP = 10;
const nRows = ROWS.reduce((a, [, , vs]) => a + vs.length, 0);
const height = Y0 + nRows * RH + (ROWS.length - 1) * SEP + 84;
const k = (m, v) => cell(m, v).correct;

module.exports = figure('fig-4-3', {
  height,
  title: 'Structured output: the answer of every task, by strategy and model',
  desc: `A grid with one row per model and strategy and one column per task: 20 chain tasks and 19 SQL tasks, each with lookup tools. A blue square is a correct structured answer, a light rose square a wrong value, an empty square no structured answer, and a solid rose square a raised error. On Qwen3 4B, ToolStrategy gave no answer in ${39 - cell(Q4, 'tool').present} of 39 tasks and ProviderStrategy raised in ${cell(Q4, 'provider').n - cell(Q4, 'provider').present} of ${cell(Q4, 'provider').n}. A second model call that extracts the answer from the final text was correct in ${k(Q4, 'extract')} of 39 on Qwen3 4B, ${k('qwen3:8b', 'extract')} on Qwen3 8B and ${k('claude-haiku-5-5', 'extract')} on Claude Haiku 5.5. Free text read by its last number was correct in ${k('claude-haiku-5-5', 'none')} of 39 on Haiku.`,
}, f => {
  f.kicker(20, 22, 'model');
  f.kicker(110, 22, 'strategy');
  f.kicker(620, 22, 'correct', { anchor: 'end' });
  f.text((X0 + chainEnd) / 2, 42, 'chain, 20 tasks', { size: 11, anchor: 'middle', hue: 'ink-soft' });
  f.text((sqlStart + XEND) / 2, 42, 'sql, 19 tasks', { size: 11, anchor: 'middle', hue: 'ink-soft' });
  f.rule(X0, 49, chainEnd, 49, { hue: 'ink-mute' });
  f.rule(sqlStart, 49, XEND, 49, { hue: 'ink-mute' });
  let y = Y0;
  ROWS.forEach(([m, name, vars], g) => {
    if (g) y += SEP;
    f.beat(g + 1);
    f.text(20, y + 11, name, { size: 11, weight: 700, hue: 'plum' });
    vars.forEach(v => {
      const c = cell(m, v);
      f.text(110, y + 11, VAR[v], { size: 11, hue: v === 'extract' ? 'plum' : 'blue' });
      const solid = { blue: '', rose: '' };
      const w = CW - 2;
      const h = RH - 5;
      for (const t of order) {
        const r = c.tasks[t];
        if (!r) continue;
        const bx = colX[t];
        const box = `M${bx.toFixed(1)} ${y + 1}h${w.toFixed(1)}v${h}h-${w.toFixed(1)}z`;
        if (r.err) solid.rose += box;
        else if (!r.present) f.rect(bx + 0.5, y + 1.5, w - 1, h - 1, { fill: 'none', stroke: color('ink-mute') });
        else if (r.ok) solid.blue += box;
        else f.rect(bx + 0.5, y + 1.5, w - 1, h - 1, { fill: color('rose-fill'), stroke: color('rose-ink') });
      }
      if (solid.blue) f.mark(solid.blue, { hue: 'blue' });
      if (solid.rose) f.mark(solid.rose, { hue: 'rose' });
      f.text(620, y + 11, `${c.correct}/${c.n}`, { size: 11, hue: 'ink', anchor: 'end', weight: 700 });
      y += RH;
    });
  });
  f.beat(0);
  const ly = y + 24;
  f.rect(20, ly - 10, 9, 12, { fill: color('blue-ink'), stroke: 'none' });
  f.text(34, ly, 'correct value', { size: 11, serif: true, hue: 'ink-soft' });
  f.rect(140.5, ly - 9.5, 8, 11, { fill: color('rose-fill'), stroke: color('rose-ink') });
  f.text(154, ly, 'wrong value', { size: 11, serif: true, hue: 'ink-soft' });
  f.rect(250.5, ly - 9.5, 8, 11, { fill: 'none', stroke: color('ink-mute') });
  f.text(264, ly, 'no structured answer', { size: 11, serif: true, hue: 'ink-soft' });
  f.rect(410, ly - 10, 9, 12, { fill: color('rose-ink'), stroke: 'none' });
  f.text(424, ly, 'raised an error', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, ly + 24, 'Qwen3 4B ProviderStrategy ran 10 of the tasks. Every run on the Mac, Haiku through the API.', { size: 11, serif: true, hue: 'ink-soft' });
});
