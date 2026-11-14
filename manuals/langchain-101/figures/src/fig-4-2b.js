'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/concurrency-x86.json'));
const levels = [1, 10, 50, 200, 500];
const setups = [
  { config: 'single', hue: 'olive', name: 'one connection', dash: 'dashed' },
  { config: 'pool20', hue: 'teal', name: 'pool of 20' },
  { config: 'pool90', hue: 'indigo', name: 'pool of 90' },
];
const cell = (config, n) => data.cells[`${config} ${n}`];
const median = values => {
  const s = [...values].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

module.exports = figure('fig-4-2b', {
  height: 360,
  title: 'Steps per second on one AsyncPostgresSaver, by threads',
  desc: `A dot chart of steps per second against threads at once, 1 to 500 on a log scale, two runs per point, on the x86 server guest. One connection rises to about 260 at 10 threads and falls to ${cell('single', 500).steps_per_s.join(' and ')} at 500. A pool of 20 reaches ${cell('pool20', 50).steps_per_s.join(' and ')} at 50 threads and gives ${cell('pool20', 500).steps_per_s.join(' and ')} at 500. A pool of 90 gives ${cell('pool90', 500).steps_per_s.join(' and ')} at 500.`,
}, f => {
  const c = chart(f, { x: 70, y: 40, w: 420, h: 250, xScale: 'log10', xDomain: [0.8, 700], yDomain: [0, 400], xTicks: levels, yTicks: [0, 100, 200, 300, 400], yLabel: 'steps per second', xLabel: 'threads at once' });
  const ends = [];
  setups.forEach(setup => {
    const points = levels.map(n => [n, median(cell(setup.config, n).steps_per_s)]);
    c.series(points, { hue: setup.hue, dash: setup.dash, dots: false });
    levels.forEach(n => cell(setup.config, n).steps_per_s.forEach((v, j) => f.dot(c.px(n) + (j ? 3 : -3), c.py(v), { hue: setup.hue, r: 3 })));
    ends.push({ ...setup, y: c.py(points[points.length - 1][1]) });
  });
  ends.sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i += 1) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
  ends.forEach(end => f.text(c.px(700) + 8, end.y + 4, end.name, { size: 11, hue: end.hue }));
  f.text(70, 346, 'Each dot is one run. 5 steps per run, a 20 ms fake model, 0 errors in all 30 runs.', { size: 11, serif: true, hue: 'ink-soft' });
});
