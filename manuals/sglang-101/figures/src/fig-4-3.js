'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-4-3', {
  height: 456,
  title: 'The default attention backend at v0.5.22',
  desc: 'A decision tree. The model attention type splits into MHA on the left and MLA on the right. For MHA: Hopper with CUDA 12.3 gives fa3 because of issue 17411, Blackwell SM100 gives trtllm_mha or fa4 for unequal K and V widths, AMD gives aiter, Apple MPS gives torch_native, and any other GPU gives flashinfer, or triton when the model has attention sinks. For MLA: Hopper gives fa3, Blackwell gives flashinfer, which DeepSeek V3 overrides to trtllm_mla, AMD gives aiter for 16 or 128 KV heads, and others give triton.',
}, f => {
  const root = f.box({ x: 180, y: 20, w: 280, h: 46, hue: 'blue', title: 'get_default_attn_backend', sub: 'no --attention-backend given' });
  const mha = f.box({ x: 20, y: 100, w: 280, h: 46, hue: 'violet', title: 'MHA model', sub: 'Llama, Qwen, Gemma' });
  const mla = f.box({ x: 340, y: 100, w: 280, h: 46, hue: 'violet', title: 'MLA model', sub: 'DeepSeek V3, GLM MoE' });
  f.arrow(root.bottom(60), mha.top(220), { style: 'call' });
  f.arrow(root.bottom(220), mla.top(60), { style: 'call' });
  const left = [
    ['Hopper', 'fa3', 'issue 17411'],
    ['Blackwell SM100', 'trtllm_mha', 'fa4 for unequal K, V'],
    ['AMD ROCm', 'aiter', 'all MHA models'],
    ['Apple MPS', 'torch_native', 'PyTorch SDPA'],
    ['other GPUs', 'flashinfer', 'triton with sinks'],
  ];
  const right = [
    ['Hopper', 'fa3', 'same as MHA'],
    ['Blackwell SM100', 'flashinfer', 'DeepSeek V3 override'],
    ['AMD ROCm', 'aiter', 'if 16 or 128 KV heads'],
    ['Apple MPS', 'torch_native', 'PyTorch SDPA'],
    ['other GPUs', 'triton', 'portable kernels'],
  ];
  [[left, 20], [right, 340]].forEach(([rows, x]) => {
    f.rule(x + 8, 146, x + 8, 170 + (rows.length - 1) * 56 + 24, { hue: 'ink-mute' });
    rows.forEach(([gpu, backend, note], index) => {
      const y = 170 + index * 56;
      f.rule(x + 8, y + 24, x + 16, y + 24, { hue: 'ink-mute' });
      f.text(x + 20, y + 28, gpu, { size: 11, hue: 'ink-soft' });
      f.box({ x: x + 128, y, w: 152, h: 48, hue: 'violet', title: backend, titleSize: 12, sub: note });
    });
  });
});
