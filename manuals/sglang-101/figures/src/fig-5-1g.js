'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const summary = load(path.join(__dirname, '../../capture/gpu/summary/l4.json'));
const runs = summary.rate;
const series = [
  { key: 'fp8', name: 'FP8', hue: 'green' },
  { key: 'default', name: 'BF16', hue: 'plum' },
];

module.exports = figure('fig-5-1g', {
  height: 350,
  title: 'The same open loop on a 24 GB L4',
  desc: 'Poisson arrivals at 0.5 to 16 requests per second on one L4 with Qwen3-8B. Dashed lines show requests completed per second, solid lines show the requests that met a first token under 1 second and a mean time per token under 100 milliseconds. FP8 serves 3.18 requests per second within the target at 4 offered. BF16 peaks at 0.96 within the target at 1 offered, and completes fewer requests as the offered rate rises past 4.',
}, f => {
  const c = chart(f, { x: 66, y: 56, w: 540, h: 230, xScale: 'log2', yScale: 'linear', xDomain: [0.5, 16], yDomain: [0, 6], xTicks: [0.5, 1, 2, 4, 8, 16], yTicks: [0, 2, 4, 6], xLabel: 'offered request rate, requests per second (Poisson)', yLabel: 'requests per second' });
  for (const s of series) {
    const points = runs[s.key].points;
    c.series(points.map(p => [p.x, p.request_throughput.median]), { hue: s.hue, dash: 'dashed', name: `${s.key}-served` });
    c.band(points.map(p => [p.x, p.goodput_rps.min]), points.map(p => [p.x, p.goodput_rps.max]), { hue: s.hue });
    c.series(points.map(p => [p.x, p.goodput_rps.median]), { hue: s.hue, name: `${s.key}-good` });
  }
  const at = (key, x) => runs[key].points.find(p => p.x === x);
  c.note(16, at('fp8', 16).request_throughput.median, `${at('fp8', 16).request_throughput.median.toFixed(2)} served`, { dx: -8, dy: 18, anchor: 'end', hue: 'green' });
  c.note(16, at('default', 16).request_throughput.median, `${at('default', 16).request_throughput.median.toFixed(2)} served`, { dx: -8, dy: 18, anchor: 'end', hue: 'plum' });
  f.text(c.px(0.5) + 10, c.py(4.6), `FP8 at 4 offered: ${at('fp8', 4).goodput_rps.median.toFixed(2)} within target`, { size: 11, serif: true, hue: 'green' });
  legend(f, [{ name: 'FP8', hue: 'green' }, { name: 'BF16', hue: 'plum' }, { name: 'served (dashed)', hue: 'ink-soft', dash: 'dashed' }, { name: 'within target (solid)', hue: 'ink-soft' }], 66, 22);
  f.text(66, 340, `target: first token under ${summary.slo.ttft_ms} ms and mean time per token under ${summary.slo.tpot_ms} ms, per request`, { size: 11, serif: true, hue: 'ink-soft' });
});
