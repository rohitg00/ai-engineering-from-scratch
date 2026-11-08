'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-2-3', {
  height: 252,
  title: 'On a DGX Spark, vLLM takes a share of one memory pool',
  desc: 'The GB10 reports 121.7 GiB in total. With a fraction of 0.75, vLLM takes 91.3 GiB: 56.93 GiB of weights, 31.32 GiB of KV cache, and about 3 GiB for the startup profile and the CUDA graphs. The other 30.4 GiB stays with the operating system, the page cache, and other programs.',
}, f => {
  const total = 121.7;
  const scale = 600 / total;
  const parts = [
    { gib: 56.93, hue: 'violet', label: 'weights', value: '56.93 GiB' },
    { gib: 31.32, hue: 'green', label: 'KV cache', value: '31.32 GiB' },
    { gib: 3.05, hue: 'amber', label: 'profile and graphs', value: 'about 3 GiB' },
    { gib: 30.4, hue: 'grey', label: 'operating system, page cache, other programs', value: '30.4 GiB' },
  ];
  f.kicker(20, 18, 'one 121.7 GiB pool, CPU and GPU together');
  let x = 20;
  const spans = parts.map(p => { const w = p.gib * scale; const span = { x, w }; x += w; return span; });
  parts.forEach((p, i) => f.rect(spans[i].x, 30, spans[i].w - (i < 3 ? 2 : 0), 46, { hue: p.hue, dash: p.hue === 'grey' ? 'dashed' : undefined }));
  f.rule(20, 92, 20 + 91.3 * scale, 92, { hue: 'blue', width: 2 });
  f.text(20, 108, 'vLLM, --gpu-memory-utilization 0.75, 91.3 GiB', { size: 11.5, weight: 700, hue: 'blue' });
  parts.forEach((p, i) => {
    const y = 140 + i * 26;
    f.rect(20, y - 10, 12, 12, { hue: p.hue });
    f.text(42, y, p.value, { size: 12, weight: 700 });
    f.text(170, y, p.label, { size: 11.5, serif: true, hue: 'ink-soft' });
  });
});
