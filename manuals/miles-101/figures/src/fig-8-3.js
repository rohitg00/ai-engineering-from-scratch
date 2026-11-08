'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-8-3', {
  height: 360,
  title: 'Two fixes for two different halves',
  desc: 'The trainer and the engine compute the same model with different kernels, so their log probabilities differ. Deterministic inference fixes only the engine half: the same input gives the same output for any batch. True on-policy mode fixes the gap itself by making both sides run the same kernels, which works only where its contract holds: FlashAttention 3 on Hopper GPUs, compute capability 9.0, and Qwen3 dense models.',
}, f => {
  const trainer = f.box({ x: 20, y: 40, w: 270, h: 76, hue: 'blue', title: 'trainer, FSDP', sub: ['its own attention kernel', 'its own matmul and sum order'] });
  const engine = f.box({ x: 350, y: 40, w: 270, h: 76, hue: 'violet', title: 'engine, SGLang', sub: ['its attention backend', 'sum order changes with batch'] });
  f.arrow([trainer.x + trainer.w, 78], [engine.x - 1, 78], { style: 'fail', head: false });
  f.text(320, 140, 'gap about 0.015', { size: 11.5, anchor: 'middle', hue: 'rose' });

  const det = f.box({ x: 350, y: 156, w: 270, h: 64, hue: 'amber', title: 'deterministic inference', sub: ['engine repeats itself, any batch'] });
  f.arrow([485, engine.y + engine.h], [485, det.y - 1], { style: 'state' });
  f.text(350, 238, 'gap stays about 0.015 in our runs', { size: 11.5, hue: 'rose' });

  const contract = f.box({ x: 20, y: 156, w: 270, h: 64, hue: 'green', title: 'true on-policy contract', sub: ['same kernels on both sides'] });
  f.arrow([155, trainer.y + trainer.h], [155, contract.y - 1], { style: 'state' });
  f.text(20, 238, 'gap goes to zero, where the contract holds', { size: 11.5, hue: 'green' });

  f.kicker(20, 278, 'what the contract pins at Miles main');
  f.text(20, 300, 'FlashAttention 3 on both sides, Hopper GPUs only', { size: 12, serif: true });
  f.text(20, 320, 'Qwen3 dense models only', { size: 12, serif: true });
  f.text(20, 344, 'A GB10 is compute capability 12.1, so the contract does not start there.', { size: 12, serif: true, hue: 'ink-soft' });
});
