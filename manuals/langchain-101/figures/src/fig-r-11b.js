'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const S = load(path.join(__dirname, '../../capture/lab/bench2/summary-bench2.json'));
const Q4 = 'qwen3:4b-instruct-2507-q4_K_M';
const wilson = (k, n) => {
  const z = 1.96;
  const p = k / n;
  const d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d;
  const h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
};
const row = (label, c, hue) => ({ label, k: c.pass, n: c.n, hue });
const profile = (m, name) => {
  const d = S.profiles[m];
  return [
    { head: `${name}, 99 tasks`, rows: [row('plain loop', d.plain, 'violet'), row('deep agent', d.deep, 'blue'), row('deep, profile B', d.profB, 'plum')] },
    { head: `${name}, 30-task subset`, rows: [row('plain loop', d.plain_sub, 'violet'), row('deep agent', d.deep_sub, 'blue'), row('deep, profile A', d.profA, 'plum'), row('deep, profile B', d.profB_sub, 'plum')] },
  ];
};
const ptc = (m, name) => {
  const d = S.ptc[m];
  const arms = [['plain', 'plain loop', 'violet'], ['deep', 'deep agent', 'blue'], ['ptc', 'deep + eval tool', 'green'], ['nudge', 'deep + eval, asked', 'indigo']];
  return { head: `${name}, chain and sql`, rows: arms.filter(([a]) => d[a]).map(([a, l, h]) => row(l, d[a], h)) };
};
const GROUPS = [
  ...profile(Q4, 'Qwen3 4B'),
  ...profile('qwen3:8b', 'Qwen3 8B'),
  ptc('qwen3:8b', 'Qwen3 8B'),
  ptc('qwen3:14b', 'Qwen3 14B'),
  ptc('gpt-oss:20b', 'gpt-oss 20B'),
  ptc('claude-haiku-5-5', 'Claude Haiku 5.5'),
  { head: 'Qwen3 8B with a Qwen3 14B grader', rows: [{ label: 'rubric, tasks failed before', k: S.rubric.recovered.length, n: S.rubric.n, hue: 'olive' }] },
];
const AX = 250;
const AW = 260;
const RH = 14;
const HEAD = 20;
const Y0 = 60;
const px = v => AX + v * AW;
const nRows = GROUPS.reduce((t, g) => t + g.rows.length, 0);
const all = GROUPS.flatMap(g => g.rows);
const small = all.filter(r => r.n < 30).length;
const widths = all.map(r => { const [lo, hi] = wilson(r.k, r.n); return hi - lo; });
const widest = Math.max(...widths);
const narrowest = Math.min(...widths);

module.exports = figure('fig-r-11b', {
  height: Y0 + nRows * RH + GROUPS.length * (HEAD + 6) + 50,
  title: 'The pass rate and its interval for every cell of the second bench',
  desc: `Dots with 95 percent Wilson intervals for ${nRows} cells of the second bench, in ${GROUPS.length} groups: two profile experiments on Qwen3 4B and Qwen3 8B, the eval tool on four models, and one rubric run. ${small} of the cells have fewer than 30 tasks. The widest interval is ${Math.round(100 * widest)} points and the narrowest is ${Math.round(100 * narrowest)} points.`,
}, f => {
  f.kicker(20, 22, 'cell');
  f.kicker(620, 22, 'pass of n', { anchor: 'end' });
  [0, 0.5, 1].forEach(v => {
    f.text(px(v), 44, `${v * 100}%`, { size: 11, anchor: 'middle', hue: 'ink-soft' });
  });
  let y = Y0;
  const bottom = Y0 + nRows * RH + GROUPS.length * (HEAD + 6) - 6;
  [0, 0.5, 1].forEach(v => f.rule(px(v), 50, px(v), bottom, { hue: 'ink-mute', opacity: 0.25 }));
  GROUPS.forEach((g, gi) => {
    f.beat(gi % 3 + 1);
    f.text(20, y + 9, g.head, { size: 11, weight: 700, hue: 'plum' });
    y += HEAD;
    g.rows.forEach(r => {
      const [lo, hi] = wilson(r.k, r.n);
      f.text(28, y + 9, r.label, { size: 11, hue: 'ink-soft', max: AX - 40 });
      f.rule(px(lo), y + 5, px(hi), y + 5, { hue: r.hue, width: 2 });
      f.rect(px(r.k / r.n) - 3.5, y + 1.5, 7, 7, { fill: color(`${r.hue}-ink`), stroke: 'none' });
      f.text(620, y + 9, `${r.k}/${r.n}`, { size: 11, hue: r.n < 30 ? 'rose' : 'ink', anchor: 'end', weight: r.n < 30 ? 700 : 400 });
      y += RH;
    });
    y += 6;
  });
  f.beat(0);
  f.text(20, y + 8, 'Whiskers are 95% Wilson intervals. Rose counts are cells of fewer than 30 tasks.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, y + 24, 'The rubric cell holds only tasks that the plain loop failed, so its baseline is 0 of 25.', { size: 11, serif: true, hue: 'ink-soft' });
});
