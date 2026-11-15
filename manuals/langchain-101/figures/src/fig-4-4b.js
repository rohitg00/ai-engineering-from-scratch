'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const S = load(path.join(__dirname, '../../capture/lab/bench/summary-mac.json'));
const T = S.toolscale.cells;
const Q4 = 'qwen3:4b-instruct-2507-q4_K_M';
const SIZES = [5, 20, 50, 100];
const get = (m, n, s) => {
  const c = T[`${m}|${n}|${s}`];
  if (!c) throw new Error(`fig-4-4b: no cell ${m} ${n} ${s}`);
  return c;
};
const median = xs => {
  const s = xs.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const PANELS = [
  { m: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', sels: ['off', 'on'], x: 70 },
  { m: Q4, name: 'Qwen3 4B on the Mac', sels: ['off', 'on', 'on_desc'], x: 380 },
];
const HUE = { off: 'blue', on: 'plum', on_desc: 'plum' };
const DX = { off: -9, on: 0, on_desc: 9 };
const money = v => `$${v.toFixed(3)}`;
const hk = s => SIZES.map(n => get('claude-haiku-5-5', n, s));
const tokOff = hk('off').map(c => c.in_tok_med);
const tokOn = hk('on').map(c => c.in_tok_med);

module.exports = figure('fig-4-4b', {
  height: 470,
  title: 'Prompt tokens of each run against the number of tools',
  desc: `Two dot charts of the prompt tokens of each run, on a log scale, at 5, 20, 50 and 100 tools, without the selector in blue and with LLMToolSelectorMiddleware in plum. On Claude Haiku 5.5 the median run sent ${tokOff.map(v => Math.round(v)).join(', ')} tokens without the selector and ${tokOn.map(v => Math.round(v)).join(', ')} with it, in ${hk('off').map(c => c.calls_med).join(', ')} and ${hk('on').map(c => c.calls_med).join(', ')} model calls. With prompt caching the ten runs at 100 tools cost ${money(hk('off')[3].cost_sum)} without the selector and ${money(hk('on')[3].cost_sum)} with it. On Qwen3 4B the selector cut the tokens, and the runs failed instead.`,
}, f => {
  PANELS.forEach((p, pi) => {
    f.beat(pi + 1);
    f.kicker(p.x - 50, 22, pi ? 'b. Qwen3 4B, the Mac' : 'a. Claude Haiku 5.5');
    const C = chart(f, { x: p.x, y: 52, w: 230, h: 230, xDomain: [-0.5, 3.5], yScale: 'log10', yDomain: [50, 100000], yTicks: [100, 1000, 10000, 100000], yFormat: v => `${v / 1000}k`, xTicks: [0, 1, 2, 3], xFormat: i => String(SIZES[i]), xLabel: 'tools bound to the agent', yLabel: 'prompt tokens per run' });
    p.sels.forEach(s => {
      const pts = SIZES.map((n, i) => {
        const c = get(p.m, n, s);
        c.runs.forEach((r, k) => f.dot(C.px(i) + DX[s] + ((k % 3) - 1) * 2, C.py(r.in), { hue: HUE[s], r: 1.7 }));
        return [i + DX[s] / 60, c.in_tok_med];
      });
      C.series(pts, { hue: HUE[s], dash: s === 'on_desc' ? 'dashed' : 'solid', dots: false, width: 1.4 });
    });
  });
  f.beat(0);
  const ty = 342;
  f.kicker(20, ty, 'a. billed for 10 runs, with prompt caching');
  SIZES.forEach((n, i) => f.text(178 + i * 64, ty + 20, `${n}`, { size: 11, hue: 'ink', anchor: 'end', weight: 700 }));
  [['off', 'no selector'], ['on', 'selector']].forEach(([s, name], r) => {
    f.text(20, ty + 38 + r * 18, name, { size: 11, hue: HUE[s] });
    SIZES.forEach((n, i) => f.text(178 + i * 64, ty + 38 + r * 18, money(get('claude-haiku-5-5', n, s).cost_sum), { size: 11, hue: 'ink', anchor: 'end' }));
  });
  [['off', 'no selector'], ['on', 'selector']].forEach(([s, name], r) => {
    f.text(20, ty + 76 + r * 18, `${name}, calls`, { size: 11, hue: HUE[s] });
    SIZES.forEach((n, i) => f.text(178 + i * 64, ty + 76 + r * 18, String(get('claude-haiku-5-5', n, s).calls_med), { size: 11, hue: 'ink', anchor: 'end' }));
  });
  f.kicker(380, ty, 'b. median seconds per run');
  SIZES.forEach((n, i) => f.text(520 + i * 33, ty + 20, `${n}`, { size: 11, hue: 'ink', anchor: 'end', weight: 700 }));
  [['off', 'none'], ['on', 'selector'], ['on_desc', '+ list']].forEach(([s, name], r) => {
    f.text(380, ty + 38 + r * 18, name, { size: 11, hue: HUE[s] });
    SIZES.forEach((n, i) => f.text(520 + i * 33, ty + 38 + r * 18, String(Math.round(get(Q4, n, s).wall_med)), { size: 11, hue: 'ink', anchor: 'end' }));
  });
  f.text(380, ty + 104, 'dashed: selector + list', { size: 11, serif: true, hue: 'plum' });
});
