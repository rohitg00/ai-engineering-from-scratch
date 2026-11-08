'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-4-1', {
  height: 400,
  title: 'One decode step, launched and replayed',
  desc: 'Two columns. On the left, eager decode: for each kernel of one transformer layer, the Python model runner sends one launch, and the step repeats this for every layer. On the right, graph replay: the decode CUDA graph runner sends one replay call for a captured batch size, and the GPU runs the recorded kernels of all layers in order.',
}, f => {
  f.kicker(20, 18, 'A · eager decode');
  f.kicker(336, 18, 'B · graph replay');
  f.rule(320, 8, 320, 392, { dash: 'dashed' });
  const kernels = ['rms_norm', 'qkv_proj GEMM', 'attention decode', 'o_proj GEMM', 'gate_up_proj GEMM', 'silu_and_mul', 'down_proj GEMM'];
  kernels.forEach((name, index) => {
    const y = 30 + index * 46;
    const launch = f.box({ x: 20, y, w: 84, h: 34, hue: 'blue', title: 'launch', titleSize: 11.5 });
    f.arrow(launch.right(), [144, y + 17], { style: 'call' });
    f.box({ x: 145, y, w: 160, h: 34, hue: 'violet', title: name, titleSize: 11.5 });
  });
  f.text(20, 366, 'one CPU launch for each kernel,', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 382, 'repeated for every layer of the model', { size: 11, serif: true, hue: 'ink-soft' });
  const replay = f.box({ x: 336, y: 30, w: 284, h: 52, hue: 'blue', title: 'replay(bs=16)', sub: ['one CPU call for the whole step'] });
  const graph = f.box({ x: 336, y: 124, w: 284, h: 160, hue: 'violet', title: 'captured decode graph, bs=16', sub: ['every layer, every kernel', 'same order as column A', 'fixed shapes and addresses', 'recorded once at startup'] });
  f.arrow(replay.bottom(), graph.top(), { style: 'call', label: 'one call' });
  f.text(336, 312, 'a batch of 13 pads to 16 and replays', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(336, 328, 'a batch above max_bs cannot replay', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(336, 344, 'and runs as column A', { size: 11, serif: true, hue: 'ink-soft' });
});
