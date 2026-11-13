'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const restore = load(path.join(__dirname, '../../capture/lab/summary/restore-limit-x86.json'));
const alone = restore.single_restores.worker_restore_seconds;
const bursts = restore.bursts;
const columns = [{ label: 'alone', seconds: alone.runs, hue: 'green' }, ...bursts.map((burst, index) => ({ label: `burst ${index + 1}`, seconds: burst.worker_restore_seconds, hue: 'violet', burst }))];
const medians = bursts.map(burst => burst.worker_restore_seconds_median);
const flight = bursts.map(burst => burst.in_flight_median);
const rates = bursts.map(burst => burst.restores_per_second);
const sizes = bursts.map(burst => burst.restores);

module.exports = figure('fig-4-5c', {
  height: 368,
  title: 'The worker restore of each actor, alone and inside a burst',
  desc: `One dot for each of ${alone.n + sizes.reduce((sum, size) => sum + size, 0)} restores that atelet logged on one node with ${restore.node_cpus} vCPU. Alone, the restore inside the worker took a median of ${alone.median.toFixed(2)} s in ${alone.n} restores. Inside ${bursts.length} bursts of ${Math.min(...sizes)} to ${Math.max(...sizes)} restores, a median of ${Math.min(...flight)} to ${Math.max(...flight)} ran at the same time, and the median restore took ${Math.min(...medians).toFixed(1)} to ${Math.max(...medians).toFixed(1)} s. Each burst finished ${Math.min(...rates).toFixed(0)} to ${Math.max(...rates).toFixed(0)} restores each second.`,
}, f => {
  f.rule(22, 18, 34, 18, { hue: 'violet', width: 2.4 });
  f.text(40, 22, 'a burst: median, box of the middle half, line from 5 to 95 percent', { size: 11, hue: 'violet' });

  f.dot(26, 40, { hue: 'green', r: 2 });
  f.text(36, 44, 'one restore alone', { size: 11, hue: 'green' });
  f.text(200, 44, 'number over a burst: median count of restores at once', { size: 11, hue: 'ink-soft' });

  const plot = chart(f, { x: 50, y: 82, w: 560, h: 236, xDomain: [-0.5, columns.length - 0.5], yDomain: [0, 4], xTicks: columns.map((_, index) => index), yTicks: [0, 0.5, 1, 2, 3, 4], xFormat: index => columns[index].label, yLabel: 'seconds of the worker restore, each actor' });
  const at = (sorted, q) => sorted[Math.round(q * (sorted.length - 1))];
  columns.forEach(({ seconds, hue, burst }, index) => {
    const cx = plot.px(index);
    if (!burst) {
      seconds.forEach((value, n) => f.dot(cx + (((n * 0.6180339887) % 1) - 0.5) * 30, plot.py(value), { hue, r: 1.6 }));
      return;
    }
    const sorted = seconds.slice().sort((a, b) => a - b);
    f.rule(cx, plot.py(at(sorted, 0.05)), cx, plot.py(at(sorted, 0.95)), { hue, width: 1.2 });
    f.rect(cx - 13, plot.py(at(sorted, 0.75)), 26, plot.py(at(sorted, 0.25)) - plot.py(at(sorted, 0.75)), { fill: color('violet-fill'), stroke: color('violet-ink') });
    f.rule(cx - 13, plot.py(at(sorted, 0.5)), cx + 13, plot.py(at(sorted, 0.5)), { hue, width: 2.4 });
    f.text(cx, plot.py(4) + 12, String(burst.in_flight_median), { size: 11, anchor: 'middle', hue: 'ink' });
  });
  f.text(plot.px(0), plot.py(alone.max) - 22, `${alone.median.toFixed(2)} s`, { size: 11, anchor: 'middle', serif: true, hue: 'green' });

  f.text(330, 356, `bursts of ${Math.min(...sizes)} to ${Math.max(...sizes)} resumes; each burst finished ${Math.min(...rates).toFixed(0)} to ${Math.max(...rates).toFixed(0)} restores each second`, { size: 11.5, serif: true, anchor: 'middle', hue: 'ink-soft' });
});
