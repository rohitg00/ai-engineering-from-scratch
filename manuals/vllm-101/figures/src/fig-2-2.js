'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-2-2', {
  height: 300,
  title: 'Where the start fails tells you which setting to change',
  desc: 'A start can fail at three points. If loading the weights fails, the model is too big for the GPU, so use FP8 weights or more GPUs. If the memory check fails, other programs hold memory, so lower the memory fraction. If the KV check fails, the maximum length needs more cache than is free, so lower the maximum length.',
}, f => {
  f.kicker(20, 18, 'the log stops at');
  const stages = [
    { x: 20, title: 'loading weights', sub: 'before the load line' },
    { x: 226, title: 'memory check', sub: 'free memory is less' },
    { x: 432, title: 'KV check', sub: 'max seq len needs' },
  ];
  stages.forEach(s => f.box({ x: s.x, y: 28, w: 188, h: 50, hue: 'blue', title: s.title, sub: s.sub }));
  f.kicker(20, 120, 'the cause');
  const causes = [
    { x: 20, title: 'weights too big', sub: 'for this GPU' },
    { x: 226, title: 'memory is shared', sub: 'other programs hold it' },
    { x: 432, title: 'cache too small', sub: 'for one full request' },
  ];
  causes.forEach(c => f.box({ x: c.x, y: 130, w: 188, h: 50, hue: 'rose', title: c.title, sub: c.sub }));
  f.kicker(20, 222, 'change this');
  const fixes = [
    { x: 20, title: 'FP8 weights', sub: 'or --tensor-parallel-size' },
    { x: 226, title: 'lower the fraction', sub: '--gpu-memory-utilization' },
    { x: 432, title: 'shorter context', sub: '--max-model-len' },
  ];
  fixes.forEach(c => f.box({ x: c.x, y: 232, w: 188, h: 50, hue: 'green', title: c.title, sub: c.sub }));
  [114, 320, 526].forEach(x => {
    f.arrow([x, 78], [x, 129], { style: 'fail' });
    f.arrow([x, 180], [x, 231], { style: 'call' });
  });
});
