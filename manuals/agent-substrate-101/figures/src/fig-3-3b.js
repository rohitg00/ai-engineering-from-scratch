'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/lab/summary/suspend-x86.json'));
const series = [
  { key: 'async', name: 'async: returns with the snapshot on the node, 10 per point', hue: 'violet' },
  { key: 'sync', name: '--mode sync: returns after the upload, 5 per point', hue: 'teal' },
];

module.exports = figure('fig-3-3b', {
  height: 356,
  title: 'What a synchronous suspend costs the caller',
  desc: 'Seconds for kubectl ate suspend actor to return against the MiB of random memory the actor holds, on the x86 server guest. The default asynchronous suspend takes a median of 0.34 s at 0 MiB, 0.50 s at 50 MiB, 0.79 s at 200 MiB, 1.17 s at 500 MiB and 1.95 s at 1000 MiB. With --mode sync it takes 0.40 s, 1.03 s, 2.02 s, 3.59 s and 6.41 s.',
}, f => {
  const c = chart(f, { x: 60, y: 78, w: 548, h: 218, xDomain: [0, 1000], yDomain: [0, 8], xTicks: [0, 50, 200, 500, 1000], yTicks: [0, 2, 4, 6, 8], xLabel: 'memory the actor holds, MiB', yLabel: 'seconds until the suspend command returns' });
  for (const s of series) {
    const points = runs[s.key].points;
    c.band(points.map(p => [p.x, p.seconds.min]), points.map(p => [p.x, p.seconds.max]), { hue: s.hue });
    c.series(points.map(p => [p.x, p.seconds.median]), { hue: s.hue, name: s.key });
    const last = points[points.length - 1];
    c.note(last.x, last.seconds.median, `${last.seconds.median.toFixed(2)} s`, { dx: -8, dy: s.key === 'sync' ? -12 : 18, anchor: 'end', hue: s.hue });
  }
  legend(f, [series[0]], 60, 22);
  legend(f, [series[1]], 60, 40);
});
