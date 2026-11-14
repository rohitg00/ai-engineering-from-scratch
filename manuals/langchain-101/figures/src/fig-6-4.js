'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/tracing-mac.json'));
const conditions = [['off', 'tracing off', 'grey'], ['ok', 'tracing on', 'olive']];
const first = conditions.map(([key]) => data.latency[key].first_run_ms.join(', '));

module.exports = figure('fig-6-4', {
  height: 366,
  title: 'Time of one agent run with tracing off and on',
  desc: `Milliseconds per agent run on the Mac, ${data.latency.off.n} runs per condition. Medians: off ${data.latency.off.median_ms} ms, on ${data.latency.ok.median_ms} ms. First runs with tracing on: ${first[1]} ms.`,
}, f => {
  const c = chart(f, { x: 70, y: 40, w: 540, h: 250, xDomain: [0, 2], yDomain: [0, 22], yTicks: [0, 5, 10, 15, 20], yLabel: 'milliseconds per agent run' });
  conditions.forEach(([key, label, hue], i) => {
    const cx = c.px(i + 0.5);
    const runs = data.latency[key].ms_per_run;
    runs.forEach((v, j) => f.dot(Math.round(cx + ((j * 37) % 61 - 30) * 2.6), Math.round(c.py(v)), { hue, r: 2 }));
    const med = data.latency[key].median_ms;
    f.rule(cx - 92, c.py(med), cx + 92, c.py(med), { hue: 'ink', width: 2 });
    f.text(cx + 96, c.py(med) + 4, `${med} ms`, { size: 11, hue: 'ink', knock: true });
    f.text(cx, 308, label, { size: 11, anchor: 'middle', hue: 'ink-soft' });
  });
  f.text(70, 336, `Each dot is one run of 7 traced runs, ${data.latency.off.n} per group. The line is the median.`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(70, 354, `Not drawn: the first run of each process, ${first[1]} ms with tracing on.`, { size: 11, serif: true, hue: 'ink-soft' });
});
