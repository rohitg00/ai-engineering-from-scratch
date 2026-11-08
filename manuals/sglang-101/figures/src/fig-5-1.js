'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

module.exports = figure('fig-5-1', {
  height: 236,
  title: 'Throughput stops at a cap of 8, latency does not',
  desc: 'Two bar charts from the benchmark sweep. Left, output token throughput at caps 1, 8 and 32 is 175.15, 255.63 and 252.74 tokens per second. Right, median time to first token at the same caps is 162.98, 785.79 and 3917.54 milliseconds.',
}, f => {
  f.kicker(20, 18, 'output tok/s');
  f.kicker(340, 18, 'median TTFT, ms');
  f.rule(320, 8, 320, 228, { dash: 'dashed' });
  const rows = [
    { cap: 'cap 1', tok: 175.15, ttft: 162.98, past: false },
    { cap: 'cap 8', tok: 255.63, ttft: 785.79, past: false },
    { cap: 'cap 32', tok: 252.74, ttft: 3917.54, past: true },
  ];
  rows.forEach((row, index) => {
    const y = 40 + index * 56;
    f.text(20, y + 16, row.cap, { size: 11.5 });
    const left = row.tok * 0.6;
    f.rect(80, y, left, 22, { fill: color(row.past ? 'rose-ink' : 'olive-ink'), stroke: 'none' });
    f.text(86 + left, y + 16, row.tok.toFixed(2), { size: 11.5 });
    f.text(340, y + 16, row.cap, { size: 11.5 });
    const right = row.ttft * 0.0425;
    f.rect(400, y, right, 22, { fill: color(row.past ? 'rose-ink' : 'olive-ink'), stroke: 'none' });
    f.text(406 + right, y + 16, row.ttft.toFixed(0), { size: 11.5 });
  });
  f.text(20, 214, '+46% from 1 to 8, -1% from 8 to 32', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(340, 214, 'x4.8 from 1 to 8, x5.0 from 8 to 32', { size: 11, serif: true, hue: 'ink-soft' });
});
