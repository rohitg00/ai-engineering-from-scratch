'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/lab/summary/cpu-limit-x86.json'));
const of = threads => runs.points.filter(point => point.threads === threads);
const single = of(1);
const four = of(4);
const at = (points, x) => points.find(point => point.x === x);
const two = value => value.toFixed(2);
const one = value => value.toFixed(1);
const cores = points => points.map(point => `${two(point.host_cores_used.median)} cores at ${point.x}`).join(', ');
const slow = at(single, 250).wall_seconds.median / at(single, 1000).wall_seconds.median;
const seen = runs.seen_inside_the_actor['250'].num_cpu;
const total = runs.points.reduce((sum, point) => sum + point.runs.length, 0);

module.exports = figure('fig-4-1b', {
  height: 340,
  title: 'Host cores an actor used at four CPU limits',
  desc: `A chart of host cores used against the cpuMillicores limit of the template, for a fixed amount of work on 1 thread and on 4 threads, three runs for each point and ${total} runs in all. With 1 thread the median was ${cores(single)} millicores. With 4 threads it was ${cores(four)} millicores. A dashed line marks the limit itself. The points follow that line, and 4 threads got no more CPU than 1 thread below 2000 millicores. The same work took ${one(at(single, 250).wall_seconds.median)} seconds at 250 millicores and ${one(at(single, 1000).wall_seconds.median)} seconds at 1000. The program saw ${seen} CPUs at every limit.`,
}, f => {
  const c = chart(f, { x: 52, y: 40, w: 400, h: 240, xDomain: [0, 2000], yDomain: [0, 2.2], xTicks: [250, 500, 1000, 2000], xFormat: v => String(v), yTicks: [0, 0.5, 1, 1.5, 2], xLabel: 'resources.limits.cpuMillicores of the template', yLabel: 'host cores used, from the cgroup of the actor' });
  f.rule(c.px(0), c.py(0), c.px(2000), c.py(2.0), { hue: 'ink-soft', dash: 'dashed' });
  c.series(four.map(point => [point.x, point.host_cores_used.median]), { hue: 'violet', name: '4 threads', dash: 'dashed', dots: false });
  c.series(single.map(point => [point.x, point.host_cores_used.median]), { hue: 'violet', name: '1 thread', dots: false });
  for (const point of four) for (const run of point.runs) f.dot(c.px(point.x) + 4, c.py(run.host_cores_used), { hue: 'violet', r: 2.4 });
  for (const point of single) for (const run of point.runs) f.dot(c.px(point.x) - 4, c.py(run.host_cores_used), { hue: 'violet', r: 2.4 });

  const right = c.px(2000) + 14;
  f.text(right, c.py(at(four, 2000).host_cores_used.median) + 4, '4 threads', { size: 11.5, weight: 700, hue: 'violet' });
  f.text(right, c.py(at(four, 2000).host_cores_used.median) + 19, `${two(at(four, 2000).host_cores_used.median)} cores at 2000`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(right, c.py(at(single, 2000).host_cores_used.median) + 4, '1 thread', { size: 11.5, weight: 700, hue: 'violet' });
  f.text(right, c.py(at(single, 2000).host_cores_used.median) + 19, `${two(at(single, 2000).host_cores_used.median)} cores at 2000,`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(right, c.py(at(single, 2000).host_cores_used.median) + 33, 'one thread fills one core', { size: 11, serif: true, hue: 'ink-soft' });

  f.text(c.px(1300), c.py(0.25) + 4, 'thin dashed line: the limit', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(c.px(60), c.py(2.0) + 16, `${two(at(single, 250).host_cores_used.median)}, ${two(at(single, 500).host_cores_used.median)} and ${two(at(single, 1000).host_cores_used.median)} cores at 250, 500 and 1000,`, { size: 11, serif: true, hue: 'violet' });
  f.text(c.px(60), c.py(2.0) + 30, 'with 1 thread and with 4 threads', { size: 11, serif: true, hue: 'violet' });
  f.text(c.px(60), c.py(1.5) + 16, `same work: ${one(at(single, 250).wall_seconds.median)} s at 250, ${one(at(single, 1000).wall_seconds.median)} s at 1000`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(c.px(60), c.py(1.5) + 30, `${one(slow)} times longer at 250`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(52, 332, `Each dot is one run, three for each point. The program saw ${seen} CPUs at every limit.`, { size: 11, serif: true, hue: 'ink-soft' });
});
