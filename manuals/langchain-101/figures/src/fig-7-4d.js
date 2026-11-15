'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const S = load(path.join(__dirname, '../../capture/lab/bench/summary-mac.json'));
const M = S.main;
const cell = (m, h) => {
  const c = M.cells[`${m}|${h}|0`];
  if (!c) throw new Error(`fig-7-4d: no cell ${m} ${h}`);
  return c;
};
const sq = (x, y, s) => `M${(x - s / 2).toFixed(1)} ${(y - s / 2).toFixed(1)}h${s}v${s}h-${s}z`;
const median = xs => {
  const s = xs.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const MODELS = [['claude-haiku-5-5', 'Claude Haiku 5.5'], ['claude-sonnet-5-5', 'Claude Sonnet 5.5']];
const ROWS = [['plain', 'cost_u', 'plain, list price', 'violet'], ['plain', 'cost', 'plain, billed', 'violet'], ['deep_agent', 'cost_u', 'deep, list price', 'blue'], ['deep_agent', 'cost', 'deep, billed', 'blue']];
const LO = 5e-5;
const HI = 0.2;
const X0 = 200;
const W = 340;
const px = v => X0 + ((Math.log10(v) - Math.log10(LO)) / (Math.log10(HI) - Math.log10(LO))) * W;
const total = (m, h, k) => Object.values(cell(m, h).tasks).reduce((a, r) => a + r[k], 0);
const ratio = (m, k) => total(m, 'deep_agent', k) / total(m, 'plain', k);
const RH = 24;
const Y0 = 70;
const BLOCK = 4 * RH + 56;

module.exports = figure('fig-7-4d', {
  height: Y0 + 2 * BLOCK + 40,
  title: 'Dollars per task, plain loop and deep agent, with and without prompt caching',
  desc: `Dot strips of the dollars of each task on a log scale, for Claude Haiku 5.5 on 99 tasks and Claude Sonnet 5.5 on 30. List price is the input and output tokens at the base price. Billed is the cost with the prompt cache reads that the API reported. Over all tasks the deep agent cost ${ratio('claude-haiku-5-5', 'cost_u').toFixed(2)} times the plain loop at list price and ${ratio('claude-haiku-5-5', 'cost').toFixed(2)} times billed on Haiku, and ${ratio('claude-sonnet-5-5', 'cost_u').toFixed(2)} and ${ratio('claude-sonnet-5-5', 'cost').toFixed(2)} times on Sonnet.`,
}, f => {
  f.kicker(20, 22, 'dollars per task, log scale');
  f.kicker(620, 22, 'all tasks', { anchor: 'end' });
  [['$0.0001', 1e-4], ['$0.001', 1e-3], ['$0.01', 1e-2], ['$0.1', 1e-1]].forEach(([label, v]) => {
    f.rule(px(v), 52, px(v), Y0 + 2 * BLOCK - 30, { hue: 'ink-mute', opacity: 0.25 });
    f.text(px(v), 46, label, { size: 11, anchor: 'middle', hue: 'ink-soft' });
  });
  let y = Y0;
  MODELS.forEach(([m, name], g) => {
    f.beat(g + 1);
    f.text(20, y + 10, `${name}, ${cell(m, 'plain').n} tasks`, { size: 11, weight: 700, hue: 'plum' });
    y += 26;
    ROWS.forEach(([h, k, label, hue]) => {
      const vals = Object.values(cell(m, h).tasks).map(r => r[k]);
      f.text(20, y + 4, label, { size: 11, hue });
      f.mark(vals.slice().sort((a, b) => a - b).map((v, i) => sq(px(v), y + ((i % 3) - 1) * 3, 3)).join(''), { hue });
      const md = median(vals);
      f.rule(px(md), y - 8, px(md), y + 8, { hue: 'ink', width: 2 });
      f.text(620, y + 4, `$${total(m, h, k).toFixed(3)}`, { size: 11, hue: 'ink', anchor: 'end', weight: k === 'cost' ? 700 : 400 });
      y += RH;
    });
    f.text(20, y + 6, `deep over plain: ${ratio(m, 'cost_u').toFixed(2)}x at list price, ${ratio(m, 'cost').toFixed(2)}x billed`, { size: 11, serif: true, hue: 'ink', knock: true });
    y += 38;
  });
  f.beat(0);
  f.text(20, y + 4, 'Black tick: the median task. Every task passed in all eight rows.', { size: 11, serif: true, hue: 'ink-soft' });
});
