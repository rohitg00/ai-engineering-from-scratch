'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/gpu/summary/l4.json')).load;
const series = [
  { key: 'default', name: 'one L4, 24,094-token pool', hue: 'plum' },
  { key: 'dp2', name: '--dp-size 2, pools of 24,094 and 2,925', hue: 'rose' },
];

module.exports = figure('fig-6-1c', {
  height: 340,
  title: 'Two copies of the model served less than one',
  desc: 'Output throughput against concurrency from 1 to 64 for Qwen3-8B, three seeds per point with a band from the lowest to the highest run. One L4 climbs to 270 tokens per second at 32 and 251 at 64. With --dp-size 2 on two L4s, where the second card was shared, the line peaks at 64 tokens per second at 8 and falls to 42 at 64.',
}, f => {
  const c = chart(f, { x: 66, y: 64, w: 540, h: 222, xScale: 'log2', xDomain: [1, 64], yDomain: [0, 300], xTicks: [1, 2, 4, 8, 16, 32, 64], yTicks: [0, 100, 200, 300], xLabel: 'max concurrency', yLabel: 'output tokens per second' });
  for (const s of series) {
    const points = runs[s.key].points;
    c.band(points.map(p => [p.x, p.output_throughput.min]), points.map(p => [p.x, p.output_throughput.max]), { hue: s.hue });
    c.series(points.map(p => [p.x, p.output_throughput.median]), { hue: s.hue, name: s.key });
    const last = points[points.length - 1];
    c.note(last.x, last.output_throughput.median, String(Math.round(last.output_throughput.median)), { dx: -10, dy: -10, anchor: 'end', hue: s.hue });
  }
  legend(f, series, 66, 22);
});
