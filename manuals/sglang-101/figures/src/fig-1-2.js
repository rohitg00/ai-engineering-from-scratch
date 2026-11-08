'use strict';

const { figure } = require('../../../_shared/figkit.js');

const layers = [
  { hue: 'olive', title: 'client', sub: 'curl, the OpenAI SDK, sglang.benchmark.serving', owner: 'yours' },
  { hue: 'grey', title: 'sgl-model-gateway', sub: 'routes requests across servers, section 6.4', owner: 'separate', dash: 'dashed' },
  { hue: 'blue', title: 'TokenizerManager', sub: 'HTTP and OpenAI API, text to token ids', owner: 'SGLang' },
  { hue: 'blue', title: 'Scheduler', sub: 'batches, admission, retraction, overlap', owner: 'SGLang' },
  { hue: 'green', title: 'KV pool and UnifiedRadixCache', sub: '181,574 slots, cached prefixes', owner: 'SGLang' },
  { hue: 'violet', title: 'forward pass', sub: 'attention backend, CUDA graphs, MLX on a Mac', owner: 'SGLang' },
  { hue: 'blue', title: 'DetokenizerManager', sub: 'token ids to text, stop strings, streaming', owner: 'SGLang' },
  { hue: 'teal', title: 'model weights', sub: 'mlx-community/Qwen3-0.6B-4bit, answer quality', owner: 'the model' },
  { hue: 'grey', title: 'memory budget and hardware', sub: '--mem-fraction-static, other programs', owner: 'operator', dash: 'dashed' },
];

module.exports = figure('fig-1-2', {
  height: 470,
  title: 'What SGLang owns',
  desc: 'A stack of nine layers from the client at the top to the hardware at the bottom. SGLang owns the tokenizer manager, the scheduler, the KV pool with its radix cache, the forward pass, and the detokenizer. The model gateway is a separate component. The model weights decide answer quality, and the operator decides the memory budget.',
}, f => {
  f.kicker(20, 18, 'layer');
  f.kicker(540, 18, 'owner');
  layers.forEach((layer, index) => {
    const y = 30 + index * 48;
    f.box({ x: 20, y, w: 500, h: 40, hue: layer.hue, dash: layer.dash, title: layer.title, sub: layer.sub, align: 'left' });
    f.text(540, y + 25, layer.owner, { size: 12, weight: layer.owner === 'SGLang' ? 700 : undefined, hue: layer.owner === 'SGLang' ? 'blue' : 'ink-soft' });
  });
});
