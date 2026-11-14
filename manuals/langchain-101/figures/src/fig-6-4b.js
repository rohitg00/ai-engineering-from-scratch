'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/tracing-mac.json'));
const order = [
  ['ok-flush', ['ok', 'flush'], 'olive'],
  ['slow-flush', ['slow', 'flush'], 'olive'],
  ['slow-fg', ['slow', 'bg off'], 'olive'],
  ['slow', ['slow'], 'olive'],
  ['e500', ['returns', '500'], 'rose'],
  ['down', ['down'], 'rose'],
  ['hang', ['hangs'], 'rose'],
];
const row = key => data.failures[key];

module.exports = figure('fig-6-4b', {
  height: 414,
  title: 'Seconds from the last run to process exit, by endpoint',
  desc: `A dot chart of the time from the last agent run to process exit on the Mac, one process of 50 agent runs per endpoint condition. With wait_for_all_tracers at the end: ${row('ok-flush').exit_lag_s} s against a working endpoint and ${row('slow-flush').exit_lag_s} s against a slow one. Without it: slow ${row('slow').exit_lag_s} s, slow with background callbacks off ${row('slow-fg').exit_lag_s} s, an endpoint that returns 500 ${row('e500').exit_lag_s} s, an endpoint that is down ${row('down').exit_lag_s} s with ${row('down').runs_received} of ${row('down').runs_expected} runs received, and an endpoint that hangs never exited and was killed at 900 s with ${row('hang').runs_received} of ${row('hang').runs_expected} runs received. Every agent run returned its answer in every condition.`,
}, f => {
  const c = chart(f, { x: 70, y: 52, w: 540, h: 230, xDomain: [0, 7], yDomain: [0, 100], yTicks: [0, 20, 40, 60, 80, 100], yLabel: 'seconds from the last run to exit' });
  order.forEach(([key, label, hue], i) => {
    const cx = c.px(i + 0.5);
    const r = row(key);
    const got = `${r.runs_received}/${r.runs_expected}`;
    if (key === 'hang') {
      f.arrow([cx, c.py(60)], [cx, c.py(100) - 8], { style: 'fail' });
      f.text(cx, c.py(100) - 14, 'killed', { size: 11, anchor: 'middle', hue });
      f.text(cx, c.py(54), got, { size: 11, anchor: 'middle', hue, knock: true });
      f.text(cx, c.py(46), 'at 900 s', { size: 11, anchor: 'middle', hue, knock: true });
    } else {
      f.dot(cx, c.py(r.exit_lag_s), { hue, r: 3.4 });
      f.text(cx, c.py(r.exit_lag_s) - 10, `${r.exit_lag_s} s`, { size: 11, anchor: 'middle', hue, knock: true });
      f.text(cx, c.py(r.exit_lag_s) - 24, got, { size: 11, anchor: 'middle', hue: 'ink-soft', knock: true });
    }
    label.forEach((line, k) => f.text(cx, 300 + k * 14, line, { size: 11, anchor: 'middle', hue: 'ink-soft' }));
  });
  f.text(70, 344, 'Each dot is one process of 50 agent runs, 350 traced runs in all.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(70, 362, 'The fraction over a dot is the traced runs that reached the endpoint.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(70, 380, 'flush: wait_for_all_tracers() after the last run. bg off:', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(70, 398, 'LANGCHAIN_CALLBACKS_BACKGROUND=false. All 50 runs answered in each process.', { size: 11, serif: true, hue: 'ink-soft' });
});
