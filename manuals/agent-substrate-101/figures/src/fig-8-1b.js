'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const store = load(path.join(__dirname, '../../capture/lab/summary/object-store-x86.json'));
const places = [
  { key: 'incluster:0', name: 'inside' },
  { key: 'external:0', name: 'outside' },
  { key: 'external:20', name: '+20 ms' },
  { key: 'external:100', name: '+100 ms' },
];
const sizes = [0, 200, 1000];
const cell = (place, mib) => store.cycles.find(item => `${item.store}:${item.added_round_trip_ms}` === place && item.mib === mib);
const panels = [
  { field: 'resume_from_store_seconds', name: 'resume from the bucket', x: 56, hue: 'teal' },
  { field: 'suspend_sync_seconds', name: 'synchronous suspend', x: 356, hue: 'amber' },
];
const two = value => value.toFixed(2);
const far = cell('external:20', 1000);
const near = cell('external:0', 1000);
const cycles = store.cycles.reduce((sum, item) => sum + item.resume_from_store_seconds.n, 0);

module.exports = figure('fig-8-1b', {
  height: 356,
  title: 'A bucket outside the cluster, and 20 or 100 ms of added round trip',
  desc: `Two panels plot every one of ${cycles} cycles on one guest. With the bucket outside the cluster and no added delay, a resume of 1,000 MiB from the bucket took a median of ${two(near.resume_from_store_seconds.median)} s. With 20 ms of added round trip it took ${two(far.resume_from_store_seconds.median)} s, and the synchronous suspend took ${two(far.suspend_sync_seconds.median)} s against ${two(near.suspend_sync_seconds.median)} s. At 100 ms only actors with no data in memory were measured.`,
}, f => {
  f.dot(26, 18, { hue: 'ink-soft', r: 1.9 });
  f.text(36, 22, 'one cycle', { size: 11, hue: 'ink-soft' });
  f.rule(120, 18, 138, 18, { hue: 'ink-soft', width: 1.8 });
  f.text(146, 22, 'medians of one size', { size: 11, hue: 'ink-soft' });
  f.text(620, 22, 'not measured: 200 and 1,000 MiB at +100 ms', { size: 11, serif: true, anchor: 'end', hue: 'ink-soft' });

  for (const panel of panels) {
    const c = chart(f, { x: panel.x, y: 70, w: 226, h: 232, xDomain: [-0.4, 3.4], yDomain: [0, 12], xTicks: [0, 1, 2, 3], yTicks: [0, 2, 4, 6, 8, 10, 12], xFormat: index => places[index].name, yLabel: `${panel.name}, seconds` });
    for (const mib of sizes) {
      const points = [];
      places.forEach((place, index) => {
        const item = cell(place.key, mib);
        if (!item) return;
        const runs = item[panel.field];
        points.push([index, runs.median]);
        runs.runs.forEach((value, n) => f.dot(c.px(index) + (n - (runs.runs.length - 1) / 2) * 3.4, c.py(value), { hue: panel.hue, r: 1.8 }));
      });
      c.series(points, { hue: panel.hue, dots: false, width: 1.6 });
      const [lastX, lastY] = points[points.length - 1];
      f.text(c.px(lastX) + 12, c.py(lastY) + (mib === 1000 ? -9 : 4), `${mib.toLocaleString('en-US')} MiB`, { size: 11, weight: 700, hue: panel.hue });
    }
  }
  f.text(320, 344, 'where the bucket is, and the round trip added between the node and the bucket', { size: 11.5, serif: true, anchor: 'middle', hue: 'ink-soft' });
});
