'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/gpu/summary/miles-gb10-lab.json')).runs;
const series = [
  { key: 'e6a-base', name: 'default', hue: 'grey', dash: 'dashed' },
  { key: 'e6b-det-triton', name: 'deterministic, Triton', hue: 'violet', dash: 'solid' },
  { key: 'e6d-det-triton-repeat', name: 'same, second run', hue: 'plum', dash: 'dotted' },
  { key: 'e6c-det-flashinfer', name: 'deterministic, FlashInfer', hue: 'indigo', dash: 'dashed' },
];

module.exports = figure('fig-4-5', {
  height: 350,
  title: 'Deterministic inference repeats, and the gap stays',
  desc: 'Logprob gap per step for four 12-step runs with seed 1. All four stay between 0.0145 and 0.0160. The two Triton runs start at the same value, 0.015404, and then drift apart.',
}, f => {
  const c = chart(f, { x: 70, y: 72, w: 550, h: 200, xDomain: [0, 11], yDomain: [0.0144, 0.0162], xTicks: [0, 3, 6, 9, 11], yTicks: [0.0145, 0.015, 0.0155, 0.016], yFormat: v => v.toFixed(4), xLabel: 'step', yLabel: 'logprob gap' });
  for (const s of series) c.series(runs[s.key].per_step.map(r => [r.step, r.logprob_abs_diff]), { hue: s.hue, dash: s.dash, name: s.name, r: 2.4 });
  c.note(0.2, 0.01612, 'step 0: both Triton runs gave 0.015404', { hue: 'violet' });
  legend(f, series.slice(0, 2), 70, 20);
  legend(f, series.slice(2), 70, 40);
  f.text(70, 332, 'The engine repeats itself. It still does not compute like the trainer.', { size: 12, serif: true });
});
