'use strict';

const { figure } = require('../../../_shared/figkit.js');

const out = [
  ['Paris', 12095], ['.', 13], ['The', 576], ['capital', 6722], ['of', 315], ['Italy', 15344],
  ['is', 374], ['Rome', 21718], ['.', 13], ['The', 576], ['capital', 6722], ['of', 315],
];

module.exports = figure('fig-8-7', {
  height: 400,
  title: 'One verify pass keeps the drafts up to the first rejection, plus one token',
  desc: 'Top: a proposer drafts three tokens, the target model checks them in one pass, keeps the first two, rejects the third, and adds its own token. Bottom: one real request with Qwen3-8B on our L4 and EAGLE3 with three drafts per step wrote 12 tokens. One came from prefill and 11 from 6 verify passes, which kept 5 of 18 drafts.',
}, f => {
  f.kicker(20, 18, 'the rule, by position');
  ['draft 1', 'draft 2', 'draft 3'].forEach((t, i) => f.box({ x: 20 + i * 130, y: 28, w: 116, h: 36, hue: 'violet', title: t }));
  const verdict = [['kept', 'green'], ['kept', 'green'], ['rejected', 'rose']];
  verdict.forEach(([t, hue], i) => {
    f.arrow([78 + i * 130, 64], [78 + i * 130, 95], { style: 'model' });
    f.box({ x: 20 + i * 130, y: 96, w: 116, h: 36, hue, dash: hue === 'rose' ? 'dashed' : undefined, title: t });
  });
  f.box({ x: 410, y: 96, w: 140, h: 36, hue: 'plum', title: 'target token' });
  f.arrow([396, 114], [409, 114], { style: 'model' });
  f.text(20, 158, 'One target pass writes the kept drafts and one token of its own.', { size: 11.5, serif: true, hue: 'ink-soft' });
  f.kicker(20, 196, 'one real request: Qwen3-8B on our L4, EAGLE3, 3 drafts');
  out.forEach(([t, id], i) => {
    const x = 20 + (i % 6) * 100;
    const y = 206 + Math.floor(i / 6) * 54;
    f.box({ x, y, w: 92, h: 44, hue: i === 0 ? 'plum' : 'green', title: t, sub: String(id), titleSize: 12 });
  });
  f.text(20, 336, 'Token 1 came from prefill. The other 11 came from 6 verify passes.', { size: 11.5, serif: true, hue: 'ink-soft' });
  f.text(20, 358, 'Drafts kept per pass: 0 in 3 passes, 1 in 2 passes, 3 in 1 pass.', { size: 11.5, serif: true, hue: 'ink-soft' });
  f.text(20, 380, 'So 5 of 18 drafts were kept, about 1.8 tokens per pass.', { size: 11.5, serif: true, hue: 'ink-soft' });
});
