'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const S = load(path.join(__dirname, '../../capture/lab/bench/summary-mac.json'));
const M = S.main;
const Q4 = 'qwen3:4b-instruct-2507-q4_K_M';
const cell = (model, harness) => {
  const c = M.cells[`${model}|${harness}|0`];
  if (!c) throw new Error(`fig-1-2b: no cell ${model} ${harness}`);
  return c;
};
const sub = new Set(M.subset);
const sq = (x, y, s) => `M${(x - s / 2).toFixed(1)} ${(y - s / 2).toFixed(1)}h${s}v${s}h-${s}z`;
const median = xs => {
  const s = xs.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const LEFT = [
  { model: Q4, h: 'plain', top: 'Qwen3 4B', bottom: 'plain', hue: 'violet', only: sub },
  { model: Q4, h: 'create_agent', top: '', bottom: 'create', hue: 'blue', only: sub },
  { model: Q4, h: 'langgraph', top: '', bottom: 'graph', hue: 'indigo', only: sub },
  { model: Q4, h: 'deep_agent', top: '', bottom: 'deep', hue: 'blue', only: sub },
  { model: 'claude-haiku-5-5', h: 'plain', top: 'Haiku', bottom: 'plain', hue: 'violet' },
  { model: 'claude-haiku-5-5', h: 'deep_agent', top: '', bottom: 'deep', hue: 'blue' },
].map(c => {
  const cl = cell(c.model, c.h);
  const tasks = Object.entries(cl.tasks).filter(([t]) => !c.only || c.only.has(t));
  return { ...c, fw: tasks.map(([, r]) => r.fw), model_s: median(tasks.map(([, r]) => r.m)), n: tasks.length };
});

const RIGHT = [
  [Q4, 'Qwen3 4B'], ['qwen3:8b', 'Qwen3 8B'], ['qwen3:14b', '14B'], ['gpt-oss:20b', 'gpt-oss'], ['qwen3:30b-a3b', '30B'],
  ['claude-haiku-5-5', 'Haiku'], ['claude-sonnet-5-5', 'Sonnet'],
].map(([model, name]) => {
  const p = cell(model, 'plain');
  const d = cell(model, 'deep_agent');
  const common = Object.keys(d.tasks).filter(t => p.tasks[t]);
  const ratios = common.map(t => d.tasks[t].in / p.tasks[t].in);
  const sum = common.reduce((a, t) => a + d.tasks[t].in, 0) / common.reduce((a, t) => a + p.tasks[t].in, 0);
  return { model, name, ratios, sum, n: common.length };
});
const allR = RIGHT.flatMap(r => r.ratios);
const rLo = Math.min(...RIGHT.map(r => r.sum));
const rHi = Math.max(...RIGHT.map(r => r.sum));
if (Math.min(...allR) < 0.5 || Math.max(...allR) > 64) throw new Error('fig-1-2b: ratio outside the axis');

module.exports = figure('fig-1-2b', {
  height: 428,
  title: 'Time outside the model, and the prompt tokens of a deep agent',
  desc: `Two dot charts. Left: the milliseconds outside the model call and the tools in each task, on a log scale, for Qwen3 4B on the 30-task subset with four harnesses and for Claude Haiku 5.5 on 99 tasks with two. Medians: ${LEFT.map(c => `${c.top || ''} ${c.bottom} ${median(c.fw).toFixed(1)} ms`).join(', ')}. The model took a median of ${LEFT[0].model_s.toFixed(1)} s per task on Qwen3 4B and ${LEFT[4].model_s.toFixed(1)} s on Haiku. Right: the prompt tokens of the deep agent divided by those of the plain loop, task by task, for seven models. Over all tasks the deep agent sent ${rLo.toFixed(2)} to ${rHi.toFixed(2)} times the prompt tokens.`,
}, f => {
  f.kicker(20, 22, 'a. outside the model, each task');
  f.kicker(372, 22, 'b. deep agent over plain loop');
  const L = chart(f, { x: 62, y: 56, w: 262, h: 270, yScale: 'log10', xDomain: [-0.5, LEFT.length - 0.5], yDomain: [1, 1000], yTicks: [1, 10, 100, 1000], yFormat: v => `${v} ms`, xTicks: [] });
  LEFT.forEach((c, i) => {
    f.beat(1);
    const cx = L.px(i);
    const fw = c.fw.slice().sort((a, b) => a - b);
    f.mark(fw.map((v, k) => sq(cx + ((k * 7) % 15) - 7, L.py(Math.max(1, v)), 3)).join(''), { hue: c.hue });
    const m = median(fw);
    f.rule(cx - 13, L.py(m), cx + 13, L.py(m), { hue: 'ink', width: 2 });
    f.text(cx, L.py(1000) - 6 + 0, `${m < 10 ? m.toFixed(1) : Math.round(m)}`, { size: 11, hue: 'ink', anchor: 'middle', weight: 700 });
    f.text(cx, 344, c.bottom, { size: 11, anchor: 'middle', hue: c.hue });
  });
  f.text(L.px(1.5), 362, `Qwen3 4B, ${LEFT[0].n} tasks`, { size: 11, anchor: 'middle', hue: 'plum' });
  f.text(L.px(4.5), 362, `Haiku, ${LEFT[4].n}`, { size: 11, anchor: 'middle', hue: 'plum' });
  f.rule(L.px(3.5), 60, L.px(3.5), 326, { hue: 'ink-mute', dash: 'dashed' });
  f.text(62, 398, `model time per task: ${LEFT[0].model_s.toFixed(1)} s on Qwen3 4B, ${LEFT[4].model_s.toFixed(1)} s on Haiku`, { size: 11, serif: true, hue: 'plum' });

  const R = chart(f, { x: 400, y: 56, w: 220, h: 270, yScale: 'log2', xDomain: [-0.5, RIGHT.length - 0.5], yDomain: [0.5, 64], yTicks: [0.5, 1, 2, 4, 8, 16, 32, 64], yFormat: v => `${v}x`, xTicks: [] });
  f.rule(R.px(-0.5), R.py(1), R.px(RIGHT.length - 0.5), R.py(1), { hue: 'violet', dash: 'dashed' });
  RIGHT.forEach((c, i) => {
    f.beat(2);
    const cx = R.px(i);
    const rs = c.ratios.slice().sort((a, b) => a - b);
    f.mark(rs.map((v, k) => sq(cx + ((k * 5) % 13) - 6, R.py(v), 2.8)).join(''), { hue: 'blue' });
    f.rule(cx - 11, R.py(c.sum), cx + 11, R.py(c.sum), { hue: 'ink', width: 2 });
    f.text(cx, i % 2 ? 358 : 344, c.name.split(' ').pop(), { size: 11, anchor: 'middle', hue: 'plum' });
    f.text(cx, 376, String(c.n), { size: 11, anchor: 'middle', hue: 'ink-soft' });
  });
  f.text(400, 398, `line: all tasks, ${rLo.toFixed(1)}x to ${rHi.toFixed(1)}x`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(400, 414, 'dashed: equal tokens', { size: 11, serif: true, hue: 'violet' });
});
