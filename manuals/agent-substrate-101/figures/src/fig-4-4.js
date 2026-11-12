'use strict';

const fs = require('fs');
const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const lab = path.join(__dirname, '../../capture/lab');
const data = load(path.join(lab, 'summary/parking-x86.json'));
const trace = Object.fromEntries(data.parking_trace.map(row => [row.event, row]));
const seconds = event => Number(trace[event].fields[1]);
const freed = (Date.parse(trace['suspend-p1-done'].t) - Date.parse(trace['p3-request-start'].t)) / 1000;
const run = data.load_run;
const refused = fs.readFileSync(path.join(lab, 'I-capacity/01-unplanned-full-pool-503.tsv'), 'utf8').trim().split('\n')
  .map(line => line.split('\t')).filter(cells => cells[3] === '503').map(cells => Number(cells[4]));
refused.push(seconds('p3-no-free-worker'));
const free = [seconds('p1'), seconds('p2')];
const served = seconds('p3-served-after-park');

const X0 = 170;
const PER_SECOND = 74;
const BUDGET = 5;
const AXIS = 252;
const x = s => X0 + s * PER_SECOND;
const two = s => s.toFixed(2);

module.exports = figure('fig-4-4', {
  height: 300,
  title: 'Requests to a full pool against the 5 second parking budget',
  desc: `Four rows on a time axis from 0 to 6 seconds, with a dashed line at the 5 second parking budget. Two requests to a pool with a free worker return 200 in ${two(Math.min(...free))} and ${two(Math.max(...free))} seconds. ${refused.length} requests to a full pool each wait ${two(Math.min(...refused))} to ${two(Math.max(...refused))} seconds and return 503. One parked request returns 200 in ${two(served)} seconds, because a worker became free ${two(freed)} seconds into its wait. In a ${run.seconds} second load run, ${run.ok} of ${run.requests} requests were served, in ${two(run.ok_average_seconds)} seconds on average and ${two(run.ok_slowest_seconds)} seconds at the slowest.`,
}, f => {
  const rows = [
    { name: 'free worker', note: 'p1 and p2, no wait', hue: 'green', end: Math.max(...free), dots: free, label: `200 in ${two(Math.min(...free))} and ${two(Math.max(...free))} s` },
    { name: 'full pool', note: `${refused.length} requests, no worker`, hue: 'rose', end: Math.max(...refused), dots: refused, label: `503 in ${two(Math.min(...refused))} to ${two(Math.max(...refused))} s`, above: true },
    { name: 'full pool', note: 'p3, then p1 suspends', hue: 'green', end: served, dots: [served], label: `200 in ${two(served)} s`, mark: freed },
    { name: 'load run, 30 s', note: `${run.ok} of ${run.requests} served`, hue: 'green', end: run.ok_slowest_seconds, dots: [run.ok_slowest_seconds], label: `slowest ${two(run.ok_slowest_seconds)} s`, average: run.ok_average_seconds, light: true },
  ];
  for (let s = 1; s <= 6; s += 1) f.rule(x(s), 34, x(s), AXIS, { hue: 'ink-mute', opacity: 0.2 });
  f.rule(x(BUDGET), 26, x(BUDGET), AXIS, { hue: 'amber', dash: 'dashed', width: 1.4 });
  f.text(x(BUDGET) - 6, 22, 'parking budget 5 s', { size: 11, hue: 'amber', anchor: 'end', weight: 700 });
  rows.forEach((row, index) => {
    const y = 48 + index * 52;
    f.text(20, y + 8, row.name, { size: 12, weight: 700 });
    f.text(20, y + 24, row.note, { size: 11, serif: true, hue: 'ink-soft' });
    f.rect(x(0), y, row.end * PER_SECOND, 16, { fill: color(`${row.hue}-fill`), stroke: color(`${row.hue}-ink`), dash: row.light ? 'dashed' : undefined });
    for (const s of row.dots) f.dot(x(s), y + 8, { hue: row.hue, r: 3.2 });
    if (row.above) f.text(x(BUDGET) - 8, y - 6, row.label, { size: 11.5, hue: row.hue, weight: 700, anchor: 'end', knock: true });
    else f.text(x(row.end) + 10, y + 12, row.label, { size: 11.5, hue: row.hue, weight: 700, knock: true });
    if (row.mark) {
      f.rule(x(row.mark), y - 5, x(row.mark), y + 21, { hue: 'violet', width: 1.6 });
      f.text(x(row.mark), y + 34, `worker free at ${two(row.mark)} s, answer ${two(row.end - row.mark)} s later`, { size: 11, hue: 'violet', anchor: 'middle', knock: true });
    }
    if (row.average) {
      f.rule(x(row.average), y - 5, x(row.average), y + 21, { hue: 'green', width: 1.6 });
      f.text(x(row.average) + 6, y + 34, `average ${two(row.average)} s`, { size: 11, hue: 'green', knock: true });
    }
  });
  f.rule(x(0), 34, x(0), AXIS, { hue: 'ink' });
  f.rule(x(0), AXIS, x(6), AXIS, { hue: 'ink' });
  for (let s = 0; s <= 6; s += 1) {
    f.rule(x(s), AXIS, x(s), AXIS + 5, { hue: 'ink' });
    f.text(x(s), AXIS + 18, String(s), { size: 11, anchor: 'middle', hue: 'ink-soft' });
  }
  f.text(x(3), AXIS + 38, 'seconds from the start of the request to its answer', { size: 11.5, serif: true, hue: 'ink-soft', anchor: 'middle' });
});
