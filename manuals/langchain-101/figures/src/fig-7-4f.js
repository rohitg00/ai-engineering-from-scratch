'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const S = load(path.join(__dirname, '../../capture/lab/bench2/summary-bench2.json'));
const MODELS = [
  ['qwen3:8b', 'Qwen3 8B, Ollama'],
  ['qwen3:14b', 'Qwen3 14B, Ollama'],
  ['gpt-oss:20b', 'gpt-oss 20B, Ollama'],
  ['claude-haiku-5-5', 'Claude Haiku 5.5, API'],
];
const ARMS = [
  ['plain', 'plain loop', 'violet'],
  ['deep', 'deep agent', 'blue'],
  ['ptc', 'deep agent + eval tool', 'green'],
  ['nudge', '+ asks for eval', 'indigo'],
];
const BX = 196;
const BW = 110;
const RH = 17;
const Y0 = 56;
const cell = (m, a) => S.ptc[m][a];
const rows = MODELS.map(([m, name]) => [m, name, ARMS.filter(([a]) => cell(m, a))]);
const nRows = rows.reduce((t, r) => t + r[2].length, 0);
const k = v => `${Math.round(v / 1000).toLocaleString('en-US')}k`;
const hay = cell('claude-haiku-5-5', 'ptc');
const hayN = cell('claude-haiku-5-5', 'nudge');
const m8 = cell('qwen3:8b', 'ptc');

module.exports = figure('fig-7-4f', {
  height: Y0 + nRows * RH + MODELS.length * 30 + 76,
  title: 'Pass counts with and without the eval tool, four models on 39 tasks',
  desc: `Bars of the pass rate on the 39 chain and sql tasks for a plain loop, a deep agent, and a deep agent with the eval tool, on Qwen3 8B, Qwen3 14B, gpt-oss 20B and Claude Haiku 5.5. Haiku passed ${hay.pass} of ${hay.n} with the eval tool and ${hayN.pass} of ${hayN.n} when the prompt asked for it, and Qwen3 8B passed ${m8.pass} of ${m8.n} with the eval tool. Columns give model calls, prompt tokens in thousands, and the median seconds per task.`,
}, f => {
  f.kicker(20, 22, 'pass of tasks');
  f.kicker(400, 22, 'calls', { anchor: 'end' });
  f.kicker(496, 22, 'prompt', { anchor: 'end' });
  f.kicker(596, 22, 'sec/task', { anchor: 'end' });
  f.rule(20, 32, 620, 32, { hue: 'ink-mute' });
  let y = Y0;
  rows.forEach(([m, name, arms], g) => {
    f.beat(g + 1);
    f.text(20, y + 4, name, { size: 11, weight: 700, hue: 'plum' });
    y += 20;
    arms.forEach(([a, label, hue]) => {
      const c = cell(m, a);
      f.text(28, y + 9, label, { size: 11, hue: 'ink-soft', max: BX - 36 });
      f.rect(BX, y, BW, RH - 5, { fill: color('panel'), stroke: color('ink-mute') });
      f.rect(BX, y, BW * c.pass / c.n, RH - 5, { fill: color(`${hue}-ink`), stroke: 'none' });
      f.text(BX + BW + 8, y + 9, `${c.pass}/${c.n}`, { size: 11, weight: 700, hue: 'ink' });
      f.text(400, y + 9, String(c.calls_sum), { size: 11, hue: 'ink', anchor: 'end' });
      f.text(496, y + 9, k(c.in_sum), { size: 11, hue: 'ink', anchor: 'end' });
      f.text(596, y + 9, c.wall_med.toFixed(1), { size: 11, hue: 'ink', anchor: 'end' });
      y += RH;
    });
    y += 10;
  });
  f.beat(0);
  f.text(20, y + 6, '12-task rows: the chain and sql tasks of the 30-task subset.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, y + 22, `No local model called eval. Haiku used it in ${hayN.eval_runs} of ${hayN.n} nudged runs.`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, y + 38, 'Local seconds come from a Mac that ran other work.', { size: 11, serif: true, hue: 'ink-soft' });
});
