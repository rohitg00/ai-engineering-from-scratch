'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-4-2', {
  height: 300,
  title: 'Which decode batches replay a graph',
  desc: 'A decode batch arrives at the decode CUDA graph runner on an 80 GB GPU at tensor parallel size 1, where max_bs is 256. A batch of 13 fits and replays the graph captured for 16. A batch of 256 replays the largest graph. A batch of 300 is above max_bs and runs eager, one launch per kernel, and the scheduler log shows cuda graph False.',
}, f => {
  f.kicker(20, 18, 'decode batch');
  f.kicker(250, 18, 'can_run_graph');
  f.kicker(450, 18, 'what runs');
  const cases = [
    { y: 30, bs: 'bs = 13', test: '13 <= 256', run: 'replay graph 16', sub: '3 padded slots', hue: 'violet', ok: true },
    { y: 110, bs: 'bs = 256', test: '256 <= 256', run: 'replay graph 256', sub: 'largest bucket', hue: 'violet', ok: true },
    { y: 190, bs: 'bs = 300', test: '300 > 256', run: 'eager forward', sub: 'cuda graph: False', hue: 'rose', ok: false },
  ];
  for (const c of cases) {
    const batch = f.box({ x: 20, y: c.y, w: 150, h: 48, hue: 'amber', title: c.bs, sub: 'running requests' });
    const test = f.box({ x: 250, y: c.y, w: 130, h: 48, hue: 'blue', title: c.test, sub: c.ok ? 'fits' : 'too large' });
    const run = f.box({ x: 450, y: c.y, w: 170, h: 48, hue: c.hue, title: c.run, sub: c.sub, dash: c.ok ? undefined : 'dashed' });
    f.arrow(batch.right(), [249, c.y + 24], { style: 'call' });
    f.arrow(test.right(), [449, c.y + 24], { style: c.ok ? 'call' : 'fail' });
  }
  f.text(20, 268, 'captured sizes: 1, 2, 4, 8, 12, then 16 to 256 in steps of 8', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 286, 'max_bs 256 is the default on an 80 GB GPU at TP 1', { size: 11, serif: true, hue: 'ink-soft' });
});
