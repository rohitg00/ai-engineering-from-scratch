'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/gpu/summary/l4.json')).load;
const series = [
  { key: 'default', name: 'BF16, 24,094-token pool', hue: 'plum' },
  { key: 'fp8', name: 'FP8 weights and KV, 142,369-token pool', hue: 'green' },
];

module.exports = figure('fig-4-3c', {
  height: 340,
  title: 'On a 24 GB card the BF16 pool fills and throughput stops climbing',
  desc: 'Output throughput against concurrency from 1 to 64 on one NVIDIA L4 with Qwen3-8B, three seeds per point with a band from the lowest to the highest run. The BF16 line climbs to 270 tokens per second at 32 and falls to 251 at 64. The FP8 line keeps climbing to 736 at 64.',
}, f => {
  const c = chart(f, { x: 66, y: 64, w: 540, h: 222, xScale: 'log2', xDomain: [1, 64], yDomain: [0, 800], xTicks: [1, 2, 4, 8, 16, 32, 64], yTicks: [0, 200, 400, 600, 800], xLabel: 'max concurrency', yLabel: 'output tokens per second' });
  for (const s of series) {
    const points = runs[s.key].points;
    c.band(points.map(p => [p.x, p.output_throughput.min]), points.map(p => [p.x, p.output_throughput.max]), { hue: s.hue });
    c.series(points.map(p => [p.x, p.output_throughput.median]), { hue: s.hue, name: s.key });
    const last = points[points.length - 1];
    c.note(last.x, last.output_throughput.median, String(Math.round(last.output_throughput.median)), { dx: -10, dy: -10, anchor: 'end', hue: s.hue });
  }
  legend(f, series, 66, 22);
});
