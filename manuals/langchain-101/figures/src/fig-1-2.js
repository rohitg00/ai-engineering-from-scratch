'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const S = load(path.join(__dirname, '../../capture/lab/bench/summary-mac.json'));
const M = S.main;
const FAM = ['chain', 'sql', 'retrieval', 'files', 'multiturn'];
const NAME = {
  'claude-haiku-5-5': 'Haiku 5.5',
  'claude-sonnet-5-5': 'Sonnet 5.5',
  'gpt-oss:20b': 'gpt-oss 20B',
  'qwen3:14b': 'Qwen3 14B',
  'qwen3:8b': 'Qwen3 8B',
  'qwen3:4b-instruct-2507-q4_K_M': 'Qwen3 4B',
  'qwen3:30b-a3b': 'Qwen3 30B-A3B',
};
const GROUPS = [
  ['claude-haiku-5-5', ['plain', 'deep_agent']],
  ['claude-sonnet-5-5', ['plain', 'deep_agent']],
  ['gpt-oss:20b', ['plain', 'deep_agent']],
  ['qwen3:14b', ['plain', 'deep_agent']],
  ['qwen3:8b', ['plain', 'create_agent', 'langgraph', 'deep_agent']],
  ['qwen3:4b-instruct-2507-q4_K_M', ['plain', 'create_agent', 'langgraph', 'deep_agent']],
  ['qwen3:30b-a3b', ['plain', 'deep_agent']],
];
const HUE = { plain: 'violet', create_agent: 'blue', langgraph: 'indigo', deep_agent: 'blue' };
const LABEL = { plain: 'plain loop', create_agent: 'create_agent', langgraph: 'StateGraph', deep_agent: 'deep agent' };

const order = M.order;
const X0 = 212;
const CW = 3.4;
const GAP = 6;
const colX = {};
let x = X0;
const famStart = {};
order.forEach((t, i) => {
  const fam = M.family[t];
  if (i && M.family[order[i - 1]] !== fam) x += GAP;
  if (!(fam in famStart)) famStart[fam] = x;
  colX[t] = x;
  x += CW;
});
const XEND = x;
const famEnd = {};
order.forEach(t => { famEnd[M.family[t]] = colX[t] + CW; });

const cell = (model, harness) => {
  const c = M.cells[`${model}|${harness}|0`];
  if (!c) throw new Error(`fig-1-2: no cell ${model} ${harness}`);
  return c;
};
const haiku = [cell('claude-haiku-5-5', 'plain'), cell('claude-haiku-5-5', 'deep_agent')];
const q4 = [cell('qwen3:4b-instruct-2507-q4_K_M', 'plain'), cell('qwen3:4b-instruct-2507-q4_K_M', 'deep_agent')];
const q8 = [cell('qwen3:8b', 'plain'), cell('qwen3:8b', 'deep_agent')];
const rowsTotal = GROUPS.reduce((a, [, hs]) => a + hs.length, 0);
const RH = 15;
const Y0 = 74;
const SEP = 7;
const height = Y0 + rowsTotal * RH + (GROUPS.length - 1) * SEP + 92;

module.exports = figure('fig-1-2', {
  height,
  title: 'The outcome of every task, for each model and harness',
  desc: `A grid with one row per model and harness and one column per task of the 99-task suite, grouped by family. A filled square is a pass, a rose square is a fail, and a blank column is a task outside the 30-task subset of that row. Claude Haiku 5.5 passed ${haiku[0].pass} of 99 with the plain loop and ${haiku[1].pass} of 99 as a deep agent. Qwen3 4B passed ${q4[0].pass} plain and ${q4[1].pass} deep, and Qwen3 8B ${q8[0].pass} and ${q8[1].pass}. On the Qwen3 models the plain loop, create_agent and the hand-built StateGraph rows are the same on every task they share.`,
}, f => {
  f.kicker(20, 24, 'model');
  f.kicker(124, 24, 'harness');
  f.kicker(620, 24, 'pass', { anchor: 'end' });
  for (const fam of FAM) {
    const cx = (famStart[fam] + famEnd[fam]) / 2;
    f.text(cx, 46, fam, { size: 11, anchor: 'middle', hue: 'ink-soft' });
    f.rule(famStart[fam], 54, famEnd[fam], 54, { hue: 'ink-mute' });
  }
  let y = Y0;
  GROUPS.forEach(([model, harnesses], g) => {
    if (g) y += SEP;
    f.beat(g + 1);
    f.text(20, y + 10, NAME[model], { size: 11, weight: 700, hue: 'plum' });
    harnesses.forEach(h => {
      const c = cell(model, h);
      f.text(124, y + 10, LABEL[h], { size: 11, hue: HUE[h] });
      const paths = { pass: '', fail: '' };
      let run = null;
      const flush = () => {
        if (run) paths[run.kind] += `M${run.x0.toFixed(1)} ${y + 1}h${(run.x1 - run.x0).toFixed(1)}v${RH - 4}h-${(run.x1 - run.x0).toFixed(1)}z`;
        run = null;
      };
      order.forEach((t, i) => {
        const r = c.tasks[t];
        if (!r) { flush(); return; }
        const kind = r.p ? 'pass' : 'fail';
        const joined = run && run.kind === kind && i > 0 && c.tasks[order[i - 1]] && M.family[order[i - 1]] === M.family[t];
        if (!joined) { flush(); run = { kind, x0: colX[t], x1: colX[t] + CW }; } else run.x1 = colX[t] + CW;
      });
      flush();
      if (paths.pass) f.mark(paths.pass, { hue: HUE[h] });
      if (paths.fail) f.mark(paths.fail, { hue: 'rose' });
      f.text(620, y + 10, `${c.pass}/${c.n}`, { size: 11, hue: 'ink', anchor: 'end', weight: 700 });
      y += RH;
    });
  });
  f.beat(0);
  f.path(order.map(t => `M${(colX[t] + CW - 0.4).toFixed(1)} ${Y0}V${y}`).join(''), { hue: 'paper', head: false, width: 0.8, packet: false });
  const ly = y + 26;
  f.rect(20, ly - 10, 10, 11, { fill: color('violet-ink'), stroke: 'none' });
  f.rect(32, ly - 10, 10, 11, { fill: color('blue-ink'), stroke: 'none' });
  f.rect(44, ly - 10, 10, 11, { fill: color('indigo-ink'), stroke: 'none' });
  f.text(60, ly, 'pass, in the colour of the harness layer', { size: 11, serif: true, hue: 'ink-soft' });
  f.rect(330, ly - 10, 10, 11, { fill: color('rose-ink'), stroke: 'none' });
  f.text(346, ly, 'fail: wrong state, wrong tool, or no answer', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, ly + 22, 'Rows with 30 tasks ran the stratified subset, six tasks of each family. Blank columns did not run.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, ly + 40, 'Qwen3 rows: greedy decoding on the Mac. Claude rows: the API, default sampling, one run per task.', { size: 11, serif: true, hue: 'ink-soft' });
});
