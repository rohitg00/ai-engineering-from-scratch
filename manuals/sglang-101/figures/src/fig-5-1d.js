'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const summary = load(path.join(__dirname, '../../capture/gpu/summary/gb10.json'));
const runs = summary.rate;
const series = [
  { key: 'fp8', name: 'FP8', hue: 'green' },
  { key: 'default', name: 'BF16', hue: 'plum' },
];

module.exports = figure('fig-5-1d', {
  height: 350,
  title: 'Requests served and requests served within the target, against offered load',
  desc: 'Poisson arrivals at 0.5 to 16 requests per second on a GB10 with Qwen3-30B-A3B. Dashed lines show requests completed per second, solid lines show the requests that met a first token under 1 second and a mean time per token under 100 milliseconds. FP8 serves 1.03 requests per second within the target at 1 offered and almost none from 4. BF16 meets the target for almost no request at any load.',
}, f => {
  const c = chart(f, { x: 66, y: 56, w: 540, h: 230, xScale: 'log2', yScale: 'linear', xDomain: [0.5, 16], yDomain: [0, 9], xTicks: [0.5, 1, 2, 4, 8, 16], yTicks: [0, 3, 6, 9], xLabel: 'offered request rate, requests per second (Poisson)', yLabel: 'requests per second' });
  for (const s of series) {
    const points = runs[s.key].points;
    c.series(points.map(p => [p.x, p.request_throughput.median]), { hue: s.hue, dash: 'dashed', name: `${s.key}-served` });
    c.band(points.map(p => [p.x, p.goodput_rps.min]), points.map(p => [p.x, p.goodput_rps.max]), { hue: s.hue });
    c.series(points.map(p => [p.x, p.goodput_rps.median]), { hue: s.hue, name: `${s.key}-good` });
  }
  const at = (key, x) => runs[key].points.find(p => p.x === x);
  c.note(16, at('fp8', 16).request_throughput.median, `${at('fp8', 16).request_throughput.median.toFixed(2)} served`, { dx: -8, dy: -8, anchor: 'end', hue: 'green' });
  c.note(16, at('default', 16).request_throughput.median, `${at('default', 16).request_throughput.median.toFixed(2)} served`, { dx: -8, dy: -8, anchor: 'end', hue: 'plum' });
  f.text(c.px(0.5) + 10, c.py(2.4), `FP8 at 1 offered: ${at('fp8', 1).goodput_rps.median.toFixed(2)} within target`, { size: 11, serif: true, hue: 'green' });
  legend(f, [{ name: 'FP8', hue: 'green' }, { name: 'BF16', hue: 'plum' }, { name: 'served (dashed)', hue: 'ink-soft', dash: 'dashed' }, { name: 'within target (solid)', hue: 'ink-soft' }], 66, 22);
  f.text(66, 340, `target: first token under ${summary.slo.ttft_ms} ms and mean time per token under ${summary.slo.tpot_ms} ms, per request`, { size: 11, serif: true, hue: 'ink-soft' });
});
