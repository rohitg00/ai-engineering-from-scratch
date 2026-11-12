'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/lab/summary/resume-x86.json'));
const series = [
  { key: 'node_local', name: 'from the node, 10 resumes per point', hue: 'violet' },
  { key: 'object_store', name: 'from the object store, 5 per point', hue: 'teal' },
];

module.exports = figure('fig-3-3', {
  height: 340,
  title: 'Resume time against the memory an actor holds',
  desc: 'Seconds for the first request to a suspended actor against the MiB of random memory it holds, on the x86 server guest with gVisor. From the node-local snapshot the median is 0.22 s at 0 MiB, 0.24 s at 50 MiB, 0.47 s at 200 MiB, 1.07 s at 500 MiB and 2.16 s at 1000 MiB. From the object store in the same cluster the median is 0.24 s, 0.41 s, 0.96 s, 2.26 s and 4.68 s. A dashed line marks 0.5 s.',
}, f => {
  const c = chart(f, { x: 60, y: 60, w: 548, h: 220, xDomain: [0, 1000], yDomain: [0, 6], xTicks: [0, 50, 200, 500, 1000], yTicks: [0, 1, 2, 3, 4, 5, 6], xLabel: 'memory the actor holds, MiB', yLabel: 'seconds from request to reply, client side' });
  c.series([[0, 0.5], [1000, 0.5]], { hue: 'ink-mute', dash: 'dashed', dots: false, width: 1 });
  c.note(1000, 0.5, '0.5 s', { dx: -4, dy: -5, anchor: 'end' });
  for (const s of series) {
    const points = runs[s.key].points;
    c.band(points.map(p => [p.x, p.seconds.min]), points.map(p => [p.x, p.seconds.max]), { hue: s.hue });
    c.series(points.map(p => [p.x, p.seconds.median]), { hue: s.hue, name: s.key });
  }
  const node = runs.node_local.points;
  const store = runs.object_store.points;
  c.note(500, store[3].seconds.median, `${store[3].seconds.median.toFixed(2)} s`, { dx: -8, dy: -8, anchor: 'end', hue: 'teal' });
  c.note(1000, store[4].seconds.median, `${store[4].seconds.median.toFixed(2)} s`, { dx: -40, dy: -12, anchor: 'end', hue: 'teal', knock: true });
  c.note(500, node[3].seconds.median, `${node[3].seconds.median.toFixed(2)} s`, { dx: 8, dy: 18, hue: 'violet' });
  c.note(1000, node[4].seconds.median, `${node[4].seconds.median.toFixed(2)} s`, { dx: -8, dy: 20, anchor: 'end', hue: 'violet' });
  legend(f, series, 60, 22);
});
