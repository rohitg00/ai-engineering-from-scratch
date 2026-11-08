'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const hot = load(path.join(__dirname, '../../capture/gpu/summary/l4-throttled.json')).load.default.points;
const cool = load(path.join(__dirname, '../../capture/gpu/summary/l4.json')).load.default.points;

module.exports = figure('fig-5-1f', {
  height: 340,
  title: 'The same server on the same L4, measured hot and measured with a cool-down',
  desc: 'Output throughput of Qwen3-8B on one NVIDIA L4 against concurrency, in two sweeps with the same command. The first sweep ran with the card near 87 C and no telemetry. The second waited for 72 C before each run and recorded the clock. The cooled sweep is higher at every point, by up to 39 percent at concurrency 32, and it falls at 64 when the KV pool is full.',
}, f => {
  const c = chart(f, { x: 66, y: 56, w: 540, h: 230, xScale: 'log2', xDomain: [1, 64], yDomain: [0, 300], xTicks: [1, 2, 4, 8, 16, 32, 64], yTicks: [0, 100, 200, 300], xLabel: 'max concurrency (benchmark client)', yLabel: 'output tokens per second' });
  c.band(cool.map(p => [p.x, p.output_throughput.min]), cool.map(p => [p.x, p.output_throughput.max]), { hue: 'blue' });
  c.series(cool.map(p => [p.x, p.output_throughput.median]), { hue: 'blue', name: 'cooled' });
  c.band(hot.map(p => [p.x, p.output_throughput.min]), hot.map(p => [p.x, p.output_throughput.max]), { hue: 'rose' });
  c.series(hot.map(p => [p.x, p.output_throughput.median]), { hue: 'rose', dash: 'dashed', name: 'hot' });
  const at = (points, x) => points.find(p => p.x === x).output_throughput.median;
  c.note(32, at(cool, 32), String(Math.round(at(cool, 32))), { dx: 0, dy: -12, anchor: 'middle', hue: 'blue' });
  c.note(32, at(hot, 32), String(Math.round(at(hot, 32))), { dx: 0, dy: 20, anchor: 'middle', hue: 'rose' });
  legend(f, [{ name: 'cool-down to 72 C, clock recorded', hue: 'blue' }, { name: 'hot, no telemetry', hue: 'rose', dash: 'dashed' }], 66, 22);
});
