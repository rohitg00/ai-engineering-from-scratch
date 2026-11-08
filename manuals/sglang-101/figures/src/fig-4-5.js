'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-4-5', {
  height: 330,
  title: 'BF16 against FP8 KV cache on Kimi K2.6',
  desc: 'Paired bars of output tokens per second at concurrency 1, 8, 16, 32, and 64, as Cloudflare reported. BF16 against FP8: 137 and 125, 731 and 689, 1106 and 1028, 1558 and 1489. At concurrency 64 the BF16 cache ran out of memory and the FP8 cache produced 2192 tokens per second.',
}, f => {
  f.kicker(20, 18, 'output tok/s by concurrency');
  const data = [['c=1', 137, 125], ['c=8', 731, 689], ['c=16', 1106, 1028], ['c=32', 1558, 1489], ['c=64', null, 2192]];
  const base = 270;
  const scale = 200 / 2192;
  f.rule(40, base, 620, base, { hue: 'ink-mute' });
  data.forEach(([label, bf16, fp8], index) => {
    const x = 60 + index * 112;
    if (bf16 === null) {
      f.rect(x, base - 40, 34, 40, { hue: 'rose', dash: 'dashed' });
      f.text(x + 17, base - 46, 'OOM', { size: 11, anchor: 'middle', hue: 'rose' });
    } else {
      const h = bf16 * scale;
      f.rect(x, base - h, 34, h, { hue: 'green', dash: 'dashed' });
      f.text(x + 17, base - h - 6, String(bf16), { size: 11, anchor: 'middle' });
    }
    const h2 = fp8 * scale;
    f.rect(x + 40, base - h2, 34, h2, { hue: 'green' });
    f.text(x + 57, base - h2 - 6, String(fp8), { size: 11, anchor: 'middle' });
    f.text(x + 37, base + 18, label, { size: 11, anchor: 'middle' });
  });
  f.rect(40, 300, 12, 12, { hue: 'green', dash: 'dashed' });
  f.text(58, 311, 'BF16 KV cache', { size: 11 });
  f.rect(200, 300, 12, 12, { hue: 'green' });
  f.text(218, 311, 'FP8 KV cache', { size: 11 });
  f.text(360, 311, 'Cloudflare, 2026-08-03', { size: 11, serif: true, hue: 'ink-soft' });
});
