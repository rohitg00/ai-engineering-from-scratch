'use strict';

const { figure } = require('../../../_shared/figkit.js');

const X0 = 200;
const STEP = 54;
const SIDE = 44;

function gpus(f, y) {
  for (let i = 0; i < 8; i += 1) {
    f.box({ x: X0 + i * STEP, y, w: SIDE, h: 26, hue: 'grey', title: `g${i}`, titleSize: 12 });
  }
}

module.exports = figure('fig-6-1', {
  height: 318,
  title: 'One TP group of eight GPUs, split three ways',
  desc: 'Eight GPUs g0 to g7 drawn in three rows. With tp-size 8 every layer is split across all eight. With attn-dp-size 4 the attention layers run in four groups of two GPUs, g0 and g1, g2 and g3, g4 and g5, g6 and g7, each with its own scheduler and KV cache. With ep-size 8 the expert layers use the same eight GPUs as one group.',
}, f => {
  f.kicker(20, 18, 'flag and layer');
  f.kicker(X0 - 4, 18, 'the same eight GPUs');

  f.text(20, 52, '--tp-size 8', { size: 12, weight: 700 });
  f.text(20, 70, 'dense and FFN layers', { size: 11, serif: true, hue: 'ink-soft' });
  f.rect(X0 - 6, 30, 8 * STEP + 6, 80, { hue: 'violet' });
  gpus(f, 40);
  f.text(X0, 96, 'one TP group: each weight matrix is cut in 8', { size: 11, serif: true, hue: 'ink-soft' });

  f.text(20, 142, '--attn-dp-size 4', { size: 12, weight: 700 });
  f.text(20, 160, 'attention layers', { size: 11, serif: true, hue: 'ink-soft' });
  for (let g = 0; g < 4; g += 1) {
    f.rect(X0 - 4 + g * 2 * STEP, 120, 2 * STEP - 2, 80, { hue: 'blue' });
    f.text(X0 + g * 2 * STEP + 2, 186, `group ${g}`, { size: 11, hue: 'blue', weight: 700 });
  }
  gpus(f, 130);
  f.text(20, 220, 'each group has its own scheduler, requests, and KV cache', { size: 11, serif: true, hue: 'ink-soft' });

  f.text(20, 252, '--ep-size 8', { size: 12, weight: 700 });
  f.text(20, 270, 'expert layers', { size: 11, serif: true, hue: 'ink-soft' });
  f.rect(X0 - 6, 236, 8 * STEP + 6, 72, { hue: 'violet' });
  gpus(f, 244);
  f.text(X0, 296, 'one expert group, equal to the TP group', { size: 11, serif: true, hue: 'ink-soft' });
});
