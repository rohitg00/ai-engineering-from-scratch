'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const store = load(path.join(__dirname, '../../capture/lab/summary/remote-store-x86.json'));
const places = [
  { key: 'remote:0:0', name: 'plain' },
  { key: 'remote-tls:0:0', name: 'TLS' },
  { key: 'remote:0:100', name: '100 Mbit/s' },
  { key: 'remote:0:20', name: '20 Mbit/s' },
  { key: 'remote:100:0', name: '+100 ms' },
];
const sizes = [0, 200, 1000];
const cell = (place, mib) => store.cycles.find(item => `${item.store}:${item.added_round_trip_ms}:${item.rate_mbit}` === place && item.mib === mib);
const panels = [
  { field: 'seconds_to_first_200', name: 'request to the first 200', x: 56, hue: 'teal', limit: true },
  { field: 'suspend_sync_seconds', name: 'synchronous suspend', x: 362, hue: 'amber', limit: false },
];
const top = 70;
const tall = 240;
const power = exponent => (10 ** exponent).toLocaleString('en-US');
const remote = store.cycles.filter(item => item.store !== 'local');
const cycles = remote.reduce((sum, item) => sum + item.suspend_sync_seconds.n, 0);
const late = remote.reduce((sum, item) => sum + (item.first_answer_codes['504'] || 0), 0);
const plain = cell('remote:0:0', 1000);
const slow = cell('remote:0:20', 200);

module.exports = figure('fig-8-1c', {
  height: 390,
  title: 'A bucket on another guest: every cycle, on a scale of powers of ten',
  desc: `Two panels plot every one of ${cycles} cycles with the bucket on a second guest. With no shaping, a request to an actor of 1,000 MiB took a median of ${plain.seconds_to_first_200.median.toFixed(1)} s to its first 200. At 20 Mbit/s, an actor of 200 MiB took ${slow.seconds_to_first_200.median.toFixed(1)} s, and its synchronous suspend took ${slow.suspend_sync_seconds.median.toFixed(1)} s. In ${late} cycles the first answer was a 504 after 10 s, and a later request returned 200.`,
}, f => {
  f.dot(26, 18, { hue: 'ink-soft', r: 1.9 });
  f.text(36, 22, 'one cycle', { size: 11, hue: 'ink-soft' });
  f.rule(110, 18, 128, 18, { hue: 'ink-soft', width: 1.8 });
  f.text(136, 22, 'median of five cycles', { size: 11, hue: 'ink-soft' });
  f.rule(300, 18, 318, 18, { hue: 'rose', width: 1.4, dash: 'dashed' });
  f.text(326, 22, 'the router answers 504 after 10 s', { size: 11, hue: 'ink-soft' });

  for (const panel of panels) {
    const c = chart(f, { x: panel.x, y: top, w: 230, h: tall, xDomain: [-0.5, 4.5], yDomain: [-1, 3], xTicks: [0, 1, 2, 3, 4], yTicks: [-1, 0, 1, 2, 3], xFormat: () => '', yFormat: power, yLabel: `${panel.name}, seconds` });
    places.forEach((place, index) => f.text(c.px(index), top + tall + (index % 2 ? 31 : 17), place.name, { size: 11, anchor: 'middle', hue: 'ink-soft' }));
    if (panel.limit) f.rule(c.px(-0.5), c.py(1), c.px(4.5), c.py(1), { hue: 'rose', width: 1.4, dash: 'dashed' });
    for (const mib of sizes) {
      places.forEach((place, index) => {
        const item = cell(place.key, mib);
        if (!item) return;
        const runs = item[panel.field];
        const middle = c.py(Math.log10(runs.median));
        runs.runs.forEach((value, n) => f.dot(c.px(index) + (n - (runs.runs.length - 1) / 2) * 3.4, c.py(Math.log10(value)), { hue: panel.hue, r: 1.8 }));
        if (runs.n > 1) f.rule(c.px(index) - 12, middle, c.px(index) + 12, middle, { hue: panel.hue, width: 1.4 });
        f.text(c.px(index), c.py(Math.log10(runs.max)) - 8, mib.toLocaleString('en-US'), { size: 11, weight: 700, anchor: 'middle', hue: panel.hue });
      });
    }
  }
  f.text(320, 362, 'the path from the node to the bucket on the other guest', { size: 11.5, serif: true, anchor: 'middle', hue: 'ink-soft' });
  f.text(320, 378, 'the number above a group is the MiB of data in the actor', { size: 11, serif: true, anchor: 'middle', hue: 'ink-soft' });
});
