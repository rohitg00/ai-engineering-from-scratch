'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/concurrency-x86-real.json'));
const levels = [1, 4, 16, 64];
const setups = [
  { config: 'single', hue: 'olive', name: 'one connection', dash: 'dashed' },
  { config: 'pool20', hue: 'teal', name: 'pool of 20' },
];
const reps = (config, n, key) => data.cells[`${config} ${n}`].reps.map(rep => rep[key]);
const mean = values => values.reduce((a, b) => a + b, 0) / values.length;
const list = (config, n, key, digits) => reps(config, n, key).map(value => value.toFixed(digits)).join(' and ');

function panel(f, c, key) {
  setups.forEach(setup => {
    c.series(levels.map(n => [n, mean(reps(setup.config, n, key))]), { hue: setup.hue, dash: setup.dash, dots: false });
    levels.forEach(n => reps(setup.config, n, key).forEach((value, j) => f.dot(c.px(n) + (setup.config === 'single' ? -3 : 3) + (j ? 1.5 : -1.5), c.py(value), { hue: setup.hue, r: 3 })));
  });
}

module.exports = figure('fig-5-2b', {
  height: 370,
  title: 'Runs per second and checkpoint write p99 on one AsyncPostgresSaver, by threads',
  desc: `Two dot charts against threads at once, 1, 4, 16, and 64, on a log scale, two runs per point, on the x86 server guest with Qwen3 4B on CPU. Left: runs per second. One connection gives ${list('single', 1, 'runs_per_s', 2)} at 1 thread and ${list('single', 64, 'runs_per_s', 2)} at 64. A pool of 20 gives ${list('pool20', 1, 'runs_per_s', 2)} at 1 thread and ${list('pool20', 64, 'runs_per_s', 2)} at 64. Right: the p99 of aput in ms, on a log scale. At 64 threads it is ${list('single', 64, 'aput_p99_ms', 0)} ms with one connection and ${list('pool20', 64, 'aput_p99_ms', 0)} ms with the pool.`,
}, f => {
  const left = chart(f, { x: 60, y: 40, w: 220, h: 230, xScale: 'log2', xDomain: [0.8, 80], yDomain: [0, 0.3], xTicks: levels, yTicks: [0, 0.1, 0.2, 0.3], yLabel: 'runs per second', xLabel: 'threads at once' });
  panel(f, left, 'runs_per_s');
  const right = chart(f, { x: 380, y: 40, w: 220, h: 230, xScale: 'log2', yScale: 'log10', xDomain: [0.8, 80], yDomain: [1, 1000], xTicks: levels, yTicks: [1, 10, 100, 1000], yLabel: 'aput p99, ms', xLabel: 'threads at once' });
  panel(f, right, 'aput_p99_ms');
  legend(f, setups, 60, 318);
  f.text(60, 344, `Each dot is one run. All ${data.runs_right_total} of ${data.runs_total} runs answered right, with ${data.errors_total} errors.`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(60, 360, 'The p99 is timed in the client, so it holds the wait of the event loop.', { size: 11, serif: true, hue: 'ink-soft' });
});
