'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const scale = load(path.join(__dirname, '../../capture/lab/summary/scale-x86.json'));
const levels = scale.bursts;
const slots = levels.map(level => level.at_one_time);
const top = levels[levels.length - 1];
const rates = levels.filter(level => level.at_one_time >= 50).flatMap(level => level.per_second_each_burst);
const fifty = levels.find(level => level.at_one_time === 50);
const ten = levels.find(level => level.at_one_time === 10);

module.exports = figure('fig-4-5b', {
  height: 356,
  title: 'Resumes at one time on one node: the time of each request, and the rate',
  desc: `Two panels for bursts of 1, 10, 50, 100 and 150 resumes at one time on one node with ${scale.pool.node_cpus} vCPU, three bursts for each size and ${scale.burst_requests_ok.requests} requests in all, every one answered with 200. The slowest of 10 took ${Math.max(...ten.max_seconds_each_burst).toFixed(2)} s. At 50 at one time the median was ${Math.min(...fifty.median_seconds_each_burst).toFixed(1)} to ${Math.max(...fifty.median_seconds_each_burst).toFixed(1)} s, and at 150 the slowest took ${Math.max(...top.max_seconds_each_burst).toFixed(1)} s. From 50 upward the node finished ${Math.min(...rates).toFixed(0)} to ${Math.max(...rates).toFixed(0)} resumes each second.`,
}, f => {
  f.path('M22 23 L34 13', { hue: 'ink-soft', head: false, width: 1.3, packet: false });
  f.text(42, 22, 'one burst, its requests from first to last answer', { size: 11, hue: 'ink-soft' });
  f.rule(410, 18, 434, 18, { hue: 'ink-soft', dash: 'dashed' });
  f.text(442, 22, '0.5 s, from the project site', { size: 11, hue: 'ink-soft' });

  const left = chart(f, { x: 46, y: 70, w: 300, h: 232, xDomain: [-0.5, 4.5], yDomain: [0, 4.5], xTicks: [0, 1, 2, 3, 4], yTicks: [0, 0.5, 1, 2, 3, 4], xFormat: index => String(slots[index]), yLabel: 'seconds until the reply, each request' });
  f.rule(left.px(-0.5), left.py(0.5), left.px(4.5), left.py(0.5), { hue: 'ink-soft', dash: 'dashed' });
  levels.forEach((level, index) => {
    level.runs.forEach((run, rep) => {
      const times = run.request_seconds;
      const x = n => left.px(index) + (rep - 1) * 15 + (times.length > 1 ? (n / (times.length - 1) - 0.5) * 11 : 0);
      if (times.length === 1) f.dot(x(0), left.py(times[0]), { hue: 'violet', r: 1.6 });
      else f.path(times.map((seconds, n) => `${n ? 'L' : 'M'}${x(n).toFixed(1)} ${left.py(seconds).toFixed(1)}`).join(' '), { hue: 'violet', head: false, width: 1.3, packet: false });
    });
  });

  const right = chart(f, { x: 404, y: 70, w: 210, h: 232, xDomain: [-0.5, 4.5], yDomain: [0, 50], xTicks: [0, 1, 2, 3, 4], yTicks: [0, 10, 20, 30, 40, 50], xFormat: index => String(slots[index]), yLabel: 'resumes finished each second' });
  levels.forEach((level, index) => level.per_second_each_burst.forEach((rate, rep) => f.dot(right.px(index) + (rep - 1) * 5, right.py(rate), { hue: 'violet', r: 2.4 })));
  right.series(levels.map((level, index) => [index, level.per_second_each_burst.slice().sort((a, b) => a - b)[1]]), { hue: 'violet', dots: false, width: 1.8 });
  f.text(right.px(2), right.py(45), `${Math.min(...rates).toFixed(0)} to ${Math.max(...rates).toFixed(0)} each second`, { size: 11, serif: true, hue: 'violet' });
  f.text(right.px(2), right.py(45) + 14, 'from 50 at one time', { size: 11, serif: true, hue: 'violet' });

  f.text(320, 344, 'resumes sent at one time, to actors that each have a snapshot on the node', { size: 11.5, serif: true, anchor: 'middle', hue: 'ink-soft' });
});
