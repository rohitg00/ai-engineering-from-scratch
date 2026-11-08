'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-4-4', {
  height: 330,
  title: 'How SGLang decides the weight format',
  desc: 'Four rows, each a checkpoint and a quantization flag. An FP8 checkpoint with no flag runs as fp8. A modelopt checkpoint with modelopt_fp4 is a known compatible pair and runs. A GPTQ checkpoint with no flag is converted at runtime and runs on the Marlin kernel. A GPTQ checkpoint with the flag gptq on a CUDA build skips the conversion and fails at startup with Unknown quantization method.',
}, f => {
  f.kicker(20, 18, 'checkpoint quant_method');
  f.kicker(230, 18, '--quantization');
  f.kicker(430, 18, 'result at startup');
  const rows = [
    { ckpt: 'fp8', flag: 'not set', result: 'fp8', sub: 'read from the checkpoint', ok: true },
    { ckpt: 'modelopt', flag: 'modelopt_fp4', result: 'modelopt_fp4', sub: 'known compatible pair', ok: true },
    { ckpt: 'gptq', flag: 'not set', result: 'gptq_marlin', sub: 'converted at runtime', ok: true },
    { ckpt: 'gptq', flag: 'gptq', result: 'startup error', sub: 'Unknown quantization method', ok: false },
  ];
  rows.forEach((row, index) => {
    const y = 30 + index * 74;
    const ckpt = f.box({ x: 20, y, w: 150, h: 48, hue: 'teal', title: row.ckpt, sub: 'weights on disk' });
    const flag = f.box({ x: 230, y, w: 150, h: 48, hue: 'olive', title: row.flag, sub: 'your command line' });
    f.box({ x: 430, y, w: 190, h: 48, hue: row.ok ? 'violet' : 'rose', title: row.result, sub: row.sub, dash: row.ok ? undefined : 'dashed' });
    f.arrow(ckpt.right(), [229, y + 24], { style: 'call' });
    f.arrow(flag.right(), [429, y + 24], { style: row.ok ? 'call' : 'fail' });
  });
});
