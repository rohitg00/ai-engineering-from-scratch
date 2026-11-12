'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/parking-x86.json'));
const trace = Object.fromEntries(data.parking_trace.map(row => [row.event, row]));
const seconds = event => Number(trace[event].fields[1]);
const freed = (Date.parse(trace['suspend-p1-done'].t) - Date.parse(trace['p3-request-start'].t)) / 1000;
const run = data.load_run;

const X0 = 150;
const PER_SECOND = 76;
const BUDGET = 5;
const x = s => X0 + s * PER_SECOND;
const label = s => `${s.toFixed(2)} s`;

module.exports = figure('fig-4-4', {
  height: 318,
  title: 'Four requests against the 5 second parking budget',
  desc: `Four horizontal bars on a time axis from 0 to 6 seconds, with a dashed line at the 5 second parking budget. A request to a pool with a free worker returns 200 in ${label(seconds('p1'))}. A request to a full pool waits ${label(seconds('p3-no-free-worker'))} and returns 503. The same request returns 200 in ${label(seconds('p3-served-after-park'))} when a worker becomes free ${label(freed)} into the wait. The slowest served request of the 30 second load run took ${label(run.ok_slowest_seconds)}.`,
}, f => {
  const rows = [
    { name: 'free worker', note: 'p1, not parked', s: seconds('p1'), hue: 'green', code: '200' },
    { name: 'full pool', note: 'p3, nothing frees', s: seconds('p3-no-free-worker'), hue: 'rose', code: '503' },
    { name: 'full pool', note: 'p3, p1 suspends', s: seconds('p3-served-after-park'), hue: 'green', code: '200', mark: freed },
    { name: 'load run', note: 'slowest served', s: run.ok_slowest_seconds, hue: 'green', code: '200' },
  ];
  f.rule(x(BUDGET), 24, x(BUDGET), 236, { hue: 'amber', dash: 'dashed', width: 1.4 });
  f.text(x(BUDGET), 16, 'budget 5 s', { size: 11, hue: 'amber', anchor: 'middle', weight: 700 });
  rows.forEach((row, index) => {
    const y = 40 + index * 50;
    f.text(20, y + 9, row.name, { size: 12, weight: 700 });
    f.text(20, y + 25, row.note, { size: 11, serif: true, hue: 'ink-soft' });
    f.rect(x(0), y, row.s * PER_SECOND, 18, { fill: color(`${row.hue}-fill`), stroke: color(`${row.hue}-ink`) });
    const inside = row.s > 3.5 && row.s < BUDGET;
    f.text(inside ? x(row.s) - 8 : x(row.s) + 8, y + 13, `${row.code} in ${label(row.s)}`, { size: 11.5, hue: row.hue, weight: 700, anchor: inside ? 'end' : 'start' });
    if (row.mark) {
      f.rule(x(row.mark), y - 6, x(row.mark), y + 24, { hue: 'violet', width: 1.4 });
      f.text(x(row.mark), y + 38, `worker free at ${label(row.mark)}`, { size: 11, hue: 'violet', anchor: 'middle' });
    }
  });
  f.rule(x(0), 236, x(6), 236, { hue: 'ink' });
  for (let s = 0; s <= 6; s += 1) {
    f.rule(x(s), 236, x(s), 241, { hue: 'ink' });
    f.text(x(s), 254, String(s), { size: 11, anchor: 'middle', hue: 'ink-soft' });
  }
  f.text(x(3), 272, 'seconds from the start of the request', { size: 11.5, serif: true, hue: 'ink-soft', anchor: 'middle' });
  f.kicker(20, 300, `load run, ${run.seconds} s`);
  f.text(150, 300, `${run.requests} requests to ${run.actors} actors on ${run.workers} workers: ${run.ok} served, ${run.shed_503} shed with 503`, { size: 11.5 });
});
