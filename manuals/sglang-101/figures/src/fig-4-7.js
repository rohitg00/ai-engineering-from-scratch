'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-4-7', {
  height: 300,
  title: 'The same feature at two batch sizes',
  desc: 'Two panels of output tokens per second for Llama-3.1-8B on one A6000 from issue 5274. At batch 1, without speculation 42.0 and with EAGLE-3 92.5. At concurrency 20, without speculation 217.8 and with EAGLE-3 164.4. Both panels use one vertical scale.',
}, f => {
  f.kicker(20, 18, 'A · batch 1');
  f.kicker(336, 18, 'B · concurrency 20');
  f.rule(320, 8, 320, 292, { dash: 'dashed' });
  const base = 240;
  const scale = 180 / 217.8;
  const panels = [
    { x: 60, off: 42.0, on: 92.5 },
    { x: 380, off: 217.8, on: 164.4 },
  ];
  for (const p of panels) {
    f.rule(p.x - 20, base, p.x + 240, base, { hue: 'ink-mute' });
    const h1 = p.off * scale;
    f.rect(p.x, base - h1, 80, h1, { hue: 'plum', dash: 'dashed' });
    f.text(p.x + 40, base - h1 - 6, `${p.off.toFixed(1)}`, { size: 11, anchor: 'middle' });
    f.text(p.x + 40, base + 18, 'no speculation', { size: 11, anchor: 'middle' });
    const h2 = p.on * scale;
    f.rect(p.x + 120, base - h2, 80, h2, { hue: 'plum' });
    f.text(p.x + 160, base - h2 - 6, `${p.on.toFixed(1)}`, { size: 11, anchor: 'middle' });
    f.text(p.x + 160, base + 18, 'EAGLE-3', { size: 11, anchor: 'middle' });
  }
  f.text(20, 284, 'output tok/s, issue 5274, 2025-04-11', { size: 11, serif: true, hue: 'ink-soft' });
});
