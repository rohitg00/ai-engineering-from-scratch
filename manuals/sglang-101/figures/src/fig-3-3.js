'use strict';

const { figure } = require('../../../_shared/figkit.js');

const rows = [
  { metric: 'benchmark duration', on: 48.81, off: 129.68, unit: 's', max: 140 },
  { metric: 'median time to first token', on: 1358, off: 7222, unit: 'ms', max: 8000 },
  { metric: 'output tokens per second', on: 83.91, off: 31.59, unit: 'tok/s', max: 100 },
];

module.exports = figure('fig-3-3', {
  height: 300,
  title: 'One benchmark, two cache settings',
  desc: 'Three pairs of bars for the shared-prefix benchmark on the capture Mac, radix cache on against --disable-radix-cache. Duration is 48.81 s against 129.68 s, median time to first token is 1,358 ms against 7,222 ms, and output throughput is 83.91 against 31.59 tokens per second.',
}, f => {
  f.rect(20, 16, 14, 12, { hue: 'green' });
  f.text(40, 26, 'radix cache on', { size: 11.5 });
  f.rect(170, 16, 14, 12, { hue: 'rose', dash: 'dashed' });
  f.text(190, 26, '--disable-radix-cache', { size: 11.5 });
  rows.forEach((row, index) => {
    const y = 52 + index * 84;
    f.kicker(20, y, row.metric);
    const scale = 420 / row.max;
    const onWidth = row.on * scale;
    const offWidth = row.off * scale;
    f.rect(20, y + 8, onWidth, 22, { hue: 'green' });
    f.text(28 + onWidth, y + 24, `${row.on.toLocaleString('en-US')} ${row.unit}`, { size: 11.5 });
    f.rect(20, y + 36, offWidth, 22, { hue: 'rose', dash: 'dashed' });
    f.text(28 + offWidth, y + 52, `${row.off.toLocaleString('en-US')} ${row.unit}`, { size: 11.5 });
  });
  f.text(20, 292, '64 prompts · 4 groups of 16 · 2,048-token shared system prompt · max concurrency 8', { size: 11, serif: true, hue: 'ink-soft' });
});
