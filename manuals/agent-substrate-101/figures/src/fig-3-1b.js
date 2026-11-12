'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/lab/summary/resume-x86.json'));
const first = runs.new_actor_first_call.points;
const later = runs.node_local.points;
const last = first[first.length - 1];
const lastLater = later[later.length - 1];

module.exports = figure('fig-3-1b', {
  height: 330,
  title: 'The first call of a new actor against the memory in its template',
  desc: 'Seconds for the first request to a new actor, which restores the golden snapshot, against the MiB of memory the template holds, on the x86 server guest. The median is 0.23 s at 0 MiB, 0.25 s at 50 MiB, 0.62 s at 200 MiB, 5.76 s at 500 MiB and 6.60 s at 1000 MiB, with a band from the fastest to the slowest of five actors. A second line shows a later resume of the same actor from its own node-local snapshot, which reaches 2.16 s at 1000 MiB.',
}, f => {
  const c = chart(f, { x: 60, y: 60, w: 548, h: 210, xDomain: [0, 1000], yDomain: [0, 14], xTicks: [0, 50, 200, 500, 1000], yTicks: [0, 2, 4, 6, 8, 10, 12, 14], xLabel: 'memory the actor holds, MiB', yLabel: 'seconds, client side' });
  c.band(first.map(p => [p.x, p.seconds.min]), first.map(p => [p.x, p.seconds.max]), { hue: 'teal' });
  c.series(first.map(p => [p.x, p.seconds.median]), { hue: 'teal', name: 'first call' });
  c.series(later.map(p => [p.x, p.seconds.median]), { hue: 'violet', name: 'later resume' });
  c.note(last.x, last.seconds.median, `${last.seconds.median.toFixed(1)} s median`, { dx: -8, dy: 16, anchor: 'end', hue: 'teal', knock: true });
  c.note(last.x, last.seconds.max, `${last.seconds.max.toFixed(1)} s slowest`, { dx: -8, dy: -4, anchor: 'end', hue: 'teal' });
  c.note(lastLater.x, lastLater.seconds.median, `${lastLater.seconds.median.toFixed(2)} s`, { dx: -8, dy: 16, anchor: 'end', hue: 'violet' });
  legend(f, [
    { name: 'first call of a new actor, median and range of 5', hue: 'teal' },
    { name: 'later resume, median of 10', hue: 'violet' },
  ], 60, 22);
});
