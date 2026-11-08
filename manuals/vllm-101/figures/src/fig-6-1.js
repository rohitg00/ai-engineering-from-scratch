'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-6-1', {
  height: 400,
  title: 'Three questions pick the parallel layout',
  desc: 'First ask whether the model and the KV cache you need fit on one GPU. If yes, add copies with data parallelism. If no, ask whether the split model fits inside one machine. If no, add pipeline parallelism across machines with tensor parallelism inside each. If yes, ask whether the GPUs have NVLink and the GPU count divides the model evenly. If yes, use tensor parallelism. If no, use pipeline parallelism inside the machine.',
}, f => {
  const q1 = f.box({ x: 170, y: 20, w: 300, h: 48, hue: 'amber', title: 'Fits one GPU with its cache?' });
  const dp = f.box({ x: 20, y: 120, w: 200, h: 54, hue: 'blue', title: 'data parallelism', sub: '--data-parallel-size N' });
  const q2 = f.box({ x: 330, y: 120, w: 290, h: 48, hue: 'amber', title: 'Split model fits one machine?' });
  const q3 = f.box({ x: 200, y: 226, w: 250, h: 48, hue: 'amber', title: 'NVLink and an even split?' });
  const ppx = f.box({ x: 466, y: 226, w: 154, h: 54, hue: 'violet', title: 'pipeline + tensor', sub: 'across machines' });
  const tp = f.box({ x: 150, y: 330, w: 190, h: 54, hue: 'violet', title: 'tensor parallel', sub: '--tensor-parallel-size' });
  const pp = f.box({ x: 360, y: 330, w: 200, h: 54, hue: 'violet', title: 'pipeline parallel', sub: '--pipeline-parallel-size' });
  f.path('M240 68 V96 H120 V119', { style: 'call' });
  f.text(150, 90, 'yes', { size: 11.5, hue: 'green', weight: 700, knock: true });
  f.path('M400 68 V96 H475 V119', { style: 'call' });
  f.text(438, 90, 'no', { size: 11.5, hue: 'rose', weight: 700, knock: true });
  f.path('M400 168 V198 H325 V225', { style: 'call' });
  f.text(366, 192, 'yes', { size: 11.5, hue: 'green', weight: 700, knock: true });
  f.path('M560 168 V198 H543 V225', { style: 'call' });
  f.text(574, 192, 'no', { size: 11.5, hue: 'rose', weight: 700, knock: true });
  f.path('M290 274 V302 H245 V329', { style: 'call' });
  f.text(266, 296, 'yes', { size: 11.5, hue: 'green', weight: 700, knock: true });
  f.path('M380 274 V302 H460 V329', { style: 'call' });
  f.text(420, 296, 'no', { size: 11.5, hue: 'rose', weight: 700, knock: true });
  f.text(20, 214, 'More output from a', { size: 11.5, serif: true, hue: 'ink-soft' });
  f.text(20, 230, 'model that fits.', { size: 11.5, serif: true, hue: 'ink-soft' });
});
