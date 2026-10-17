'use strict';

const { figure } = require('../figkit.js');
const { chart, legend } = require('../chart.js');

const runs = [
  { x: 1, median: 30, min: 29, max: 31 },
  { x: 4, median: 58, min: 56, max: 60 },
  { x: 16, median: 101, min: 99, max: 104 },
  { x: 64, median: 235, min: 232, max: 241 },
];

module.exports = figure('tpl-chart', {
  height: 320,
  title: 'One measured series with its spread over repeated runs',
  desc: 'A line of medians rises over a doubling axis from 1 to 64, with a shaded band from the lowest to the highest of three repeated runs at each point and a note on the last point.',
}, f => {
  const c = chart(f, { x: 66, y: 56, w: 540, h: 210, xScale: 'log2', xDomain: [1, 64], yDomain: [0, 300], xTicks: [1, 2, 4, 8, 16, 32, 64], yTicks: [0, 100, 200, 300], xLabel: 'max concurrency', yLabel: 'output tokens per second' });
  c.band(runs.map(r => [r.x, r.min]), runs.map(r => [r.x, r.max]), { hue: 'plum' });
  c.series(runs.map(r => [r.x, r.median]), { hue: 'plum' });
  c.note(64, 235, '235', { dx: 6, dy: 4, hue: 'plum' });
  legend(f, [{ name: 'median of three runs', hue: 'plum' }], 66, 22);
});
