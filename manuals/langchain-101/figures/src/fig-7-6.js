'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/tracing-mac-real.json'));
const il = data.interleave;
const conditions = [['off', 'tracing off', 'grey'], ['on', 'tracing on', 'olive']];

module.exports = figure('fig-7-6', {
  height: 366,
  title: 'Time outside the model of one agent run with tracing off and on',
  desc: `Milliseconds outside the model per agent run of Qwen3 4B on the Mac, ${il.off.n} runs per condition, interleaved in one process. Medians: off ${il.off.non_model_ms_median} ms, on ${il.on.non_model_ms_median} ms, ${il.paired_on_minus_off_ms_median} ms more in pairs of runs. The median run took ${il.on.wall_ms_median} ms with tracing on.`,
}, f => {
  const c = chart(f, { x: 70, y: 40, w: 540, h: 250, xDomain: [0, 2], yDomain: [0, 60], yTicks: [0, 10, 20, 30, 40, 50, 60], yLabel: 'milliseconds outside the model' });
  conditions.forEach(([key, label, hue], i) => {
    const cx = c.px(i + 0.5);
    il[key].non_model_ms.forEach((v, j) => f.dot(Math.round(cx + ((j * 37) % 61 - 30) * 2.6), Math.round(c.py(v)), { hue, r: 2 }));
    const med = il[key].non_model_ms_median;
    f.rule(cx - 92, c.py(med), cx + 92, c.py(med), { hue: 'ink', width: 2 });
    f.text(cx + 96, c.py(med) + 4, `${med} ms`, { size: 11, hue: 'ink', knock: true });
    f.text(cx, 308, label, { size: 11, anchor: 'middle', hue: 'ink-soft' });
  });
  f.text(70, 336, `Each dot is one agent run of 7 traced runs, ${il.off.n} per group. The line is the median.`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(70, 354, `Not drawn: the first two runs. The first spent ${il.first_run_non_model_ms} ms outside the model.`, { size: 11, serif: true, hue: 'ink-soft' });
});
