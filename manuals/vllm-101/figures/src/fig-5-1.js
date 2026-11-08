'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const pts = load(path.join(__dirname, '../../capture/gpu/summary/l4.json')).load['vllm-b'].points;

module.exports = figure('fig-5-1', {
  height: 330,
  title: 'The sweep finds the knee: output peaks at 32 users on the L4',
  desc: 'Output tokens per second against users at the same time for vLLM 0.31.0 on an NVIDIA L4 with Qwen3-8B, three seeds per point. Output rises from 13.5 at one user to 275.1 at 32 users, then falls to 242.3 at 64 users, where requests queue for KV cache space.',
}, f => {
  const c = chart(f, { x: 66, y: 60, w: 540, h: 210, xScale: 'log2', xDomain: [1, 64], yDomain: [0, 300], xTicks: [1, 2, 4, 8, 16, 32, 64], yTicks: [0, 100, 200, 300], xLabel: 'users at the same time', yLabel: 'output tokens per second' });
  c.band(pts.map(p => [p.x, p.output_throughput.min]), pts.map(p => [p.x, p.output_throughput.max]), { hue: 'plum' });
  c.series(pts.map(p => [p.x, p.output_throughput.median]), { hue: 'plum' });
  c.note(32, 275.14, 'knee, 275', { dx: -8, dy: -10, anchor: 'end', hue: 'plum', serif: false });
  c.note(64, 242.32, '242', { dx: -4, dy: 18, anchor: 'end', hue: 'plum', serif: false });
  legend(f, [{ name: 'median of three runs, band from lowest to highest', hue: 'plum' }], 66, 22);
});
