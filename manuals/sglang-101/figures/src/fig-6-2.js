'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-6-2', {
  height: 236,
  title: 'One token through an MoE layer',
  desc: 'Four stages from left to right. TopK picks experts for each token. The dispatcher, chosen with moe-a2a-backend, moves tokens to the GPUs that hold those experts. MoeRunner computes the local experts with a grouped matrix multiply chosen with moe-runner-backend. The dispatcher combines the results and moves them back.',
}, f => {
  const w = 142;
  const y = 40;
  const h = 92;
  const stages = [
    { x: 20, hue: 'violet', title: 'TopK', sub: ['picks experts', 'for each token'] },
    { x: 176, hue: 'indigo', title: 'dispatch', sub: ['tokens move to', 'expert GPUs'] },
    { x: 332, hue: 'plum', title: 'MoeRunner', sub: ['grouped matrix', 'multiply'] },
    { x: 488, hue: 'indigo', title: 'combine', sub: ['results move', 'back to tokens'] },
  ];
  f.kicker(20, 22, 'one MoE layer, every step');
  const boxes = stages.map(stage => f.box({ x: stage.x, y, w, h, hue: stage.hue, title: stage.title, sub: stage.sub }));
  for (let i = 0; i < boxes.length - 1; i += 1) {
    f.arrow(boxes[i].right(), [boxes[i + 1].x - 1, boxes[i].cy], { style: i === 0 ? 'call' : 'event' });
  }
  f.text(176, 156, '--moe-a2a-backend', { size: 11, hue: 'indigo' });
  f.text(332, 156, '--moe-runner-backend', { size: 11, hue: 'plum' });
  f.text(488, 156, '--moe-a2a-backend', { size: 11, hue: 'indigo' });
  f.rule(20, 176, 630, 176, { hue: 'ink-mute', opacity: 0.4 });
  f.text(20, 198, '--deepep-mode auto: normal for prefill batches, low_latency for decode', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 218, 'all-to-all backends set --ep-size to --tp-size', { size: 11, serif: true, hue: 'ink-soft' });
});
