'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-5-1b', {
  height: 268,
  title: 'What each line of the benchmark report is computed from',
  desc: 'Five lines of the benchmark report, each with the formula calculate_metrics uses and the value from the run at a cap of 8: Concurrency 7.96, Peak concurrent requests 16, median TTFT 785.79 ms, median TPOT 22.52 ms, median ITL 20.35 ms.',
}, f => {
  f.kicker(20, 18, 'report line');
  f.kicker(232, 18, 'computed as');
  f.kicker(515, 18, 'at cap 8');
  const rows = [
    ['Concurrency', 'sum of E2E latencies / duration', '7.96'],
    ['Peak concurrent requests', 'most requests active in one second', '16'],
    ['TTFT', 'send to first streamed chunk', '785.79 ms'],
    ['TPOT', '(latency - TTFT) / (tokens - 1)', '22.52 ms'],
    ['ITL', 'every gap between two chunks, pooled', '20.35 ms'],
  ];
  rows.forEach(([line, formula, value], index) => {
    const y = 32 + index * 46;
    f.box({ x: 20, y, w: 200, h: 34, hue: 'olive', title: line, titleSize: 12 });
    f.text(232, y + 22, formula, { size: 11.5, serif: true, hue: 'ink-soft' });
    f.text(515, y + 22, value, { size: 11.5 });
  });
  f.text(20, 262, 'Median values for TTFT, TPOT, and ITL.', { size: 11, serif: true, hue: 'ink-soft' });
});
