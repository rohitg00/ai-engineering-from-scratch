'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const lab = path.join(__dirname, '../../capture/lab/summary');
const scale = load(path.join(lab, 'scale-x86.json'));
const again = load(path.join(lab, 'bursts-one-node-x86.json'));
const series = [{ levels: scale.bursts, hue: 'violet' }, { levels: again.bursts, hue: 'teal' }];
const slots = series.flatMap(({ levels, hue }) => levels.map(level => ({ level, hue })));
const rates = slots.filter(slot => slot.level.at_one_time >= 50).flatMap(slot => slot.level.per_second_each_burst);
const ten = scale.bursts.find(level => level.at_one_time === 10);
const top = again.bursts[again.bursts.length - 1];
const hung = again.hung_requests.hung.length;
const last = slots.length - 1;

module.exports = figure('fig-4-5b', {
  height: 384,
  title: 'Resumes at one time on one node: the time of each request, and the rate',
  desc: `Two panels for bursts of 1 to 300 resumes at one time on one node with ${scale.pool.node_cpus} vCPU, in two runs. The first run had 200 workers and three bursts of each size from 1 to 150. The second run had 300 workers and bursts of 150, 200 and 300. The slowest of 10 took ${Math.max(...ten.max_seconds_each_burst).toFixed(2)} s. At 300 at one time the median was ${Math.min(...top.median_seconds_each_burst).toFixed(1)} to ${Math.max(...top.median_seconds_each_burst).toFixed(1)} s. From 50 upward the node finished ${Math.min(...rates).toFixed(0)} to ${Math.max(...rates).toFixed(0)} resumes each second. ${hung} requests of the second run got no answer in 90 s and are not drawn.`,
}, f => {
  f.path('M22 23 L34 13', { hue: 'ink-soft', head: false, width: 1.3, packet: false });
  f.text(42, 22, 'one burst, its requests from first to last answer', { size: 11, hue: 'ink-soft' });
  f.rule(410, 18, 434, 18, { hue: 'ink-soft', dash: 'dashed' });
  f.text(442, 22, '0.5 s, from the project site', { size: 11, hue: 'ink-soft' });
  f.dot(26, 44, { hue: 'violet', r: 3 });
  f.text(36, 48, 'first run: 200 workers, 1 or 2 connections', { size: 11, hue: 'violet' });
  f.dot(330, 44, { hue: 'teal', r: 3 });
  f.text(340, 48, 'second run: 300 workers, 1 connection each', { size: 11, hue: 'teal' });

  const left = chart(f, { x: 46, y: 96, w: 340, h: 232, xDomain: [-0.5, last + 0.5], yDomain: [0, 10], xTicks: slots.map((_, index) => index), yTicks: [0, 0.5, 2, 4, 6, 8, 10], xFormat: index => String(slots[index].level.at_one_time), yLabel: 'seconds until the reply, each request' });
  f.rule(left.px(-0.5), left.py(0.5), left.px(last + 0.5), left.py(0.5), { hue: 'ink-soft', dash: 'dashed' });
  slots.forEach(({ level, hue }, index) => {
    const centre = (level.runs.length - 1) / 2;
    level.runs.forEach((run, rep) => {
      const all = run.request_seconds;
      const times = all.length > 31 ? Array.from({ length: 31 }, (_, k) => all[Math.round((k / 30) * (all.length - 1))]) : all;
      const x = n => left.px(index) + (rep - centre) * 12 + (times.length > 1 ? (n / (times.length - 1) - 0.5) * 9 : 0);
      if (times.length === 1) f.dot(x(0), left.py(times[0]), { hue, r: 1.6 });
      else f.path(times.map((seconds, n) => `${n ? 'L' : 'M'}${x(n).toFixed(1)} ${left.py(seconds).toFixed(1)}`).join(' '), { hue, head: false, width: 1.3, packet: false });
    });
  });

  const right = chart(f, { x: 436, y: 96, w: 180, h: 232, xScale: 'log10', xDomain: [0.7, 450], yDomain: [0, 50], xTicks: [1, 10, 100, 300], yTicks: [0, 10, 20, 30, 40, 50], yLabel: 'resumes finished each second' });
  series.forEach(({ levels, hue }, side) => {
    levels.forEach(level => level.per_second_each_burst.forEach(rate => f.dot(right.px(level.at_one_time) + (side ? 3 : -3), right.py(rate), { hue, r: 2.2 })));
    right.series(levels.map(level => [level.at_one_time, level.per_second_each_burst.slice().sort((a, b) => a - b)[Math.floor(level.per_second_each_burst.length / 2)]]), { hue, dots: false, width: 1.6 });
  });
  f.text(right.px(2), right.py(47), `${Math.min(...rates).toFixed(0)} to ${Math.max(...rates).toFixed(0)} each second`, { size: 11, serif: true, hue: 'ink' });
  f.text(right.px(2), right.py(47) + 14, 'from 50 at one time', { size: 11, serif: true, hue: 'ink' });

  f.text(320, 372, 'resumes sent at one time, to actors that each have a snapshot on the node', { size: 11.5, serif: true, anchor: 'middle', hue: 'ink-soft' });
});
