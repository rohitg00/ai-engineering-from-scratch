'use strict';

const { figure } = require('../../../_shared/figkit.js');

const SCALE = 600 / 50;

module.exports = figure('fig-3-2', {
  height: 300,
  title: 'The same Mac, two memory splits',
  desc: 'Two bars on one scale of 0 to 50 GB. Exploratory run 2 saw 38.29 GB free and gave 33.39 GB to the KV pool with mem_fraction_static 0.872, leaving 4.90 GB, and it crashed with Insufficient Memory at concurrency 32. The kit run saw 48.49 GB free and gave 19.39 GB to the pool with 0.4, leaving 29.10 GB, and it finished 128 requests at concurrency 32.',
}, f => {
  const bars = [
    { y: 40, label: 'exploratory run 2 · fraction 0.872 (automatic)', free: 38.29, kv: 33.39, result: 'Insufficient Memory at concurrency 32, server killed', fail: true },
    { y: 170, label: 'capture kit · --mem-fraction-static 0.4', free: 48.49, kv: 19.39, result: '128 of 128 requests finished at concurrency 32', fail: false },
  ];
  for (const bar of bars) {
    f.kicker(20, bar.y - 12, bar.label);
    const kvWidth = bar.kv * SCALE;
    const restWidth = (bar.free - bar.kv) * SCALE;
    f.rect(20, bar.y, kvWidth, 44, { hue: 'green' });
    f.text(30, bar.y + 27, `KV pool ${bar.kv.toFixed(2)} GB`, { size: 12, hue: 'green', weight: 700 });
    f.rect(20 + kvWidth, bar.y, restWidth, 44, { hue: bar.fail ? 'rose' : 'grey', dash: bar.fail ? 'dashed' : undefined });
    if (restWidth > 160) f.text(30 + kvWidth, bar.y + 27, `left for activations ${(bar.free - bar.kv).toFixed(2)} GB`, { size: 11.5, serif: true });
    else f.text(20, bar.y + 64, `left for activations and other programs: ${(bar.free - bar.kv).toFixed(2)} GB`, { size: 11.5, serif: true, hue: 'rose' });
    f.text(20, bar.y + (bar.fail ? 84 : 64), bar.result, { size: 11.5, hue: bar.fail ? 'rose' : 'ink-soft', serif: true });
  }
  f.rule(20, 276, 620, 276, { hue: 'ink-mute' });
  [0, 10, 20, 30, 40, 50].forEach(gb => {
    const x = 20 + gb * SCALE;
    f.rule(x, 272, x, 280, { hue: 'ink-mute' });
    f.text(x, 294, `${gb} GB`, { size: 11, anchor: gb === 0 ? 'start' : gb === 50 ? 'end' : 'middle', hue: 'ink-mute' });
  });
});
