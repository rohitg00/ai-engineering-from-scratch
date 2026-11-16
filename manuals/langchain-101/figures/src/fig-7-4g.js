'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const S = load(path.join(__dirname, '../../capture/lab/bench2/summary-bench2.json'));
const H = S.ptc['claude-haiku-5-5'];
const ARMS = [['ptc', 'eval tool, plain prompt', 'green'], ['nudge', 'eval tool, prompt asks for it', 'indigo']];
const METRICS = [
  ['model calls', c => c.calls_sum, v => String(v)],
  ['prompt tokens', c => c.in_sum, v => `${(v / 1e6).toFixed(2)}M`],
  ['output tokens', c => c.out_sum, v => `${(v / 1000).toFixed(1)}k`],
  ['dollars', c => c.cost, v => `$${v.toFixed(3)}`],
  ['eval calls', c => c.eval_calls, v => String(v)],
  ['eval errors', c => c.eval_errors, v => String(v)],
];
const ids = Object.keys(H.ptc.tasks);
const SQ = 11;
const STEP = 14.4;
const X0 = 20;
const BX = 150;
const BW = 300;
const RH = 15;
const GAP = 12;
const TOP = 54;
const stripY = i => TOP + i * 50 + 16;
const BARS_Y = TOP + 2 * 50 + 34;
const ev = a => ids.filter(t => H[a].tasks[t].ev > 0).length;

module.exports = figure('fig-7-4g', {
  height: BARS_Y + METRICS.length * (2 * RH + GAP) + 50,
  title: 'Claude Haiku 5.5 with the eval tool, with and without a prompt that asks for it',
  desc: `Two strips of the 39 chain and sql tasks, one square per task, show which runs called the eval tool: ${ev('ptc')} runs without the prompt and ${ev('nudge')} runs with it. Every task passed in both arms. Below, paired bars compare model calls, prompt tokens, output tokens, dollars, eval calls and eval errors of the two arms: ${H.ptc.calls_sum} and ${H.nudge.calls_sum} calls, and $${H.ptc.cost.toFixed(3)} and $${H.nudge.cost.toFixed(3)}.`,
}, f => {
  f.kicker(20, 22, 'each square is one task');
  f.kicker(620, 22, `${ids.length} tasks, all passed`, { anchor: 'end' });
  f.rule(20, 32, 620, 32, { hue: 'ink-mute' });
  ARMS.forEach(([a, label, hue], i) => {
    f.beat(i + 1);
    const y = stripY(i);
    f.text(X0, y - 6, `${label}: ${ev(a)} of ${ids.length} runs called eval`, { size: 11, weight: 700, hue });
    ids.forEach((t, j) => {
      const used = H[a].tasks[t].ev > 0;
      f.rect(X0 + j * STEP, y, SQ, SQ, used ? { fill: color(`${hue}-ink`), stroke: 'none' } : { fill: color(`${hue}-fill`), stroke: color(`${hue}-ink`), strokeWidth: 0.8 });
    });
  });
  f.beat(0);
  f.text(X0, stripY(1) + 32, 'Dark square: the run called eval. Pale square: it used the task tools directly.', { size: 11, serif: true, hue: 'ink-soft' });
  f.kicker(20, BARS_Y - 8, 'two arms, same 39 tasks');
  let y = BARS_Y;
  METRICS.forEach(([name, get, show], g) => {
    f.beat(g % 2 + 1);
    f.text(20, y + RH + 2, name, { size: 11, hue: 'ink-soft' });
    const top = Math.max(...ARMS.map(([a]) => get(H[a])));
    ARMS.forEach(([a, , hue], i) => {
      const v = get(H[a]);
      const w = top ? BW * v / top : 0;
      const by = y + i * RH;
      if (w > 0) f.rect(BX, by, w, RH - 4, { fill: color(`${hue}-ink`), stroke: 'none' });
      else f.rule(BX, by, BX, by + RH - 4, { hue: 'ink-mute' });
      f.text(BX + w + 8, by + 9, show(v), { size: 11, weight: 700, hue: 'ink' });
    });
    y += 2 * RH + GAP;
  });
  f.beat(0);
  f.text(20, y + 2, 'Green is the plain prompt and indigo is the prompt that asks for eval.', { size: 11, serif: true, hue: 'ink-soft' });
});
