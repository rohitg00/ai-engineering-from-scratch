'use strict';

const { figure } = require('../../../_shared/figkit.js');

const phases = ['generate', 'release', 'train', 'onload', 'update', 'onload KV'];
const tracks = [
  ['SGLang weights', 'violet', [1, 0, 0, 1, 1, 1]],
  ['SGLang KV cache', 'green', [1, 0, 0, 0, 0, 1]],
  ['CUDA graphs', 'violet', [1, 0, 0, 0, 0, 1]],
  ['trainer', 'grey', [0, 0, 1, 0, 0, 0]],
];
const left = 140;
const cell = 80;

module.exports = figure('fig-7-2b', {
  height: 300,
  title: 'GPU memory across one colocated RL step',
  desc: 'Six phases of one Miles step on shared GPUs. SGLang holds weights, KV cache, and CUDA graphs while it generates, releases all three, the trainer runs alone, then SGLang gets its weights back, receives the new weights, and finally gets its KV cache and CUDA graphs back.',
}, f => {
  phases.forEach((name, index) => {
    f.kicker(left + index * cell + cell / 2, 22, name, { anchor: 'middle' });
  });
  tracks.forEach(([name, hue, resident], row) => {
    const y = 40 + row * 46;
    f.text(20, y + 22, name, { size: 11.5 });
    resident.forEach((present, index) => {
      const x = left + index * cell + 4;
      if (present) f.rect(x, y, cell - 8, 32, { hue });
      else f.rect(x, y, cell - 8, 32, { stroke: 'none', fill: 'none' });
    });
    f.rule(left, y + 38, left + phases.length * cell, y + 38, { opacity: 0.4 });
  });
  f.arrow([left + cell + 4, 236], [left + cell * 2 - 4, 236], { style: 'state' });
  f.text(left + cell + 40, 258, 'POST /release_memory_occupation', { size: 11, anchor: 'middle', hue: 'amber' });
  f.text(left + cell * 4 + 40, 236, 'POST /update_weights_from_tensor', { size: 11, anchor: 'middle', hue: 'ink' });
  f.text(20, 286, 'filled cell: the memory is resident on the GPU · empty cell: released or offloaded', { size: 11, serif: true, hue: 'ink-soft' });
});
