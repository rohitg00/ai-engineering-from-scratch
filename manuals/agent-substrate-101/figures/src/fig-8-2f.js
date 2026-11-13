'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const drain = load(path.join(__dirname, '../../capture/lab/summary/node-drain-x86.json'));
const names = {
  a: ['RUNNING,', 'one request each second'],
  b: ['suspended with --mode sync,', 'no request during the drain'],
  b2: ['suspended with --mode sync,', 'requests from 2 s after the drain'],
  c: ['suspended, default mode,', 'newest snapshot still PENDING'],
  d: ['RUNNING,', 'one request of 120 s open'],
};
const LEFT = 188;
const RIGHT = 460;
const FIRST = -5;
const LAST = 70;
const px = t => LEFT + (Math.min(Math.max(t, FIRST), LAST) - FIRST) * (RIGHT - LEFT) / (LAST - FIRST);
const TOP = 52;
const STEP = 50;

function outcome(item) {
  if (item.revert) return [`${item.failed_after_drain} of ${item.requests_after_drain} failed`, `revert, 200 after ${item.revert.seconds_to_first_ok} s`];
  return [`${item.ok_after_drain} of ${item.requests_after_drain} returned 200`, `first answer in ${item.first_ok_seconds.toFixed(2)} s`];
}

module.exports = figure('fig-8-2f', {
  height: TOP + STEP * drain.cases.length + 62,
  title: 'Five drains of one worker node, request by request',
  desc: `Five rows, one for each actor state at the moment of a kubectl drain. The two actors that were RUNNING failed every request after the drain until a revert that we sent, ${drain.cases[0].failed_after_drain} of ${drain.cases[0].requests_after_drain} and ${drain.cases[4].failed_after_drain} of ${drain.cases[4].requests_after_drain} requests. The three suspended actors returned 200 on their first request after the drain with no command, on the other node.`,
}, f => {
  f.rect(20, 14, 4, 10, { fill: color('green-ink'), stroke: 'none' });
  f.text(30, 23, 'one request, 200', { size: 11, hue: 'ink-soft' });
  f.rect(150, 14, 4, 10, { fill: color('rose-ink'), stroke: 'none' });
  f.text(160, 23, 'one request, failed', { size: 11, hue: 'ink-soft' });
  f.rule(298, 12, 298, 26, { hue: 'ink', dash: 'dashed' });
  f.text(306, 23, 'the revert that we sent', { size: 11, hue: 'ink-soft' });
  f.rect(470, 14, 12, 10, { hue: 'grey', stroke: 'none' });
  f.text(488, 23, 'kubectl drain runs', { size: 11, hue: 'ink-soft' });

  drain.cases.forEach((item, index) => {
    const y = TOP + index * STEP;
    const [first, second] = names[item.case];
    f.text(20, y + 12, first, { size: 11.5, serif: true, hue: 'ink' });
    f.text(20, y + 27, second, { size: 11.5, serif: true, hue: 'ink-soft' });
    f.rule(px(FIRST), y + 30, px(LAST), y + 30, { hue: 'ink-soft' });
    f.rect(px(0), y + 2, px(item.drain_returned_seconds) - px(0), 28, { hue: 'grey', stroke: 'none' });
    const flight = item.request_in_flight;
    if (flight) f.rect(px(flight.sent_t), y + 20, px(flight.returned_t) - px(flight.sent_t), 6, { fill: color('rose-ink'), stroke: 'none' });
    for (const probe of item.probes) {
      if (probe.t > LAST) continue;
      f.rect(px(probe.t) - 1.5, y + 6, 3, 14, { fill: color(probe.code === '200' ? 'green-ink' : 'rose-ink'), stroke: 'none' });
    }
    if (item.revert) f.rule(px(item.revert.t), y - 2, px(item.revert.t), y + 34, { hue: 'ink', dash: 'dashed' });
    const [head, tail] = outcome(item);
    f.text(RIGHT + 12, y + 12, head, { size: 11, weight: 700, hue: item.revert ? 'rose' : 'green' });
    f.text(RIGHT + 12, y + 27, tail, { size: 11, serif: true, hue: 'ink-soft' });
  });

  const axis = TOP + drain.cases.length * STEP + 6;
  f.rule(px(FIRST), axis, px(LAST), axis, { hue: 'ink' });
  for (const t of [0, 10, 20, 30, 40, 50, 60, 70]) {
    f.rule(px(t), axis - 4, px(t), axis + 4, { hue: 'ink' });
    f.text(px(t), axis + 18, `${t} s`, { size: 11, anchor: 'middle', hue: 'ink-soft' });
  }
  f.text((px(FIRST) + px(LAST)) / 2, axis + 38, 'seconds since the drain command', { size: 11.5, serif: true, anchor: 'middle', hue: 'ink-soft' });
});
