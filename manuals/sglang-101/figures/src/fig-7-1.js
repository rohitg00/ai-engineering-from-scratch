'use strict';

const { figure } = require('../../../_shared/figkit.js');

const key = [
  ['SIGTERM to the main process: /health returns 503 and the drain loop starts', 'state'],
  ['remaining requests reach 0, logged every 5 s while the drain runs', 'state'],
  ['ShutdownReq goes to the schedulers, which get 15 s to exit', 'state'],
  ['force exit when the server is UnHealthy or SGL_FORCE_SHUTDOWN is set', 'fail'],
  ['SIGTERM to the whole process group: scheduler_0 exits first with -15', 'fail'],
  ['the parent reads a crashed child and kills the tree with no drain', 'fail'],
];

module.exports = figure('fig-7-1', {
  height: 430,
  title: 'Three ways an SGLang server stops',
  desc: 'A serving SGLang server that receives SIGTERM on its main process drains, sends ShutdownReq, and exits with code 0. The same server forced to exit skips the drain, and a SIGTERM sent to the whole process group kills the scheduler child first, so the parent takes the crash path and kills the process tree.',
}, f => {
  f.kicker(20, 22, 'graceful path');
  f.box({ x: 20, y: 36, w: 110, h: 56, hue: 'amber', title: 'serving', sub: ['/health 200'] });
  f.box({ x: 170, y: 36, w: 120, h: 56, hue: 'amber', title: 'draining', sub: ['/health 503', 'drain every 5 s'] });
  f.box({ x: 330, y: 36, w: 120, h: 56, hue: 'blue', title: 'ShutdownReq', sub: ['15 s to exit'] });
  f.box({ x: 490, y: 36, w: 130, h: 56, hue: 'amber', title: 'exit code 0', sub: ['drained in 13 s'], double: true });
  f.arrow([130, 64], [169, 64], { style: 'state' });
  f.arrow([290, 64], [329, 64], { style: 'state' });
  f.arrow([450, 64], [489, 64], { style: 'state' });
  f.step(150, 46, 1, { hue: 'amber' });
  f.step(310, 46, 2, { hue: 'amber' });
  f.step(470, 46, 3, { hue: 'amber' });

  f.kicker(170, 132, 'forced');
  f.box({ x: 150, y: 146, w: 180, h: 50, hue: 'rose', title: 'force_exit_handler', sub: ['drops running work'], double: true });
  f.line(230, 92, 230, 145, { style: 'fail' });
  f.step(246, 118, 4, { hue: 'rose' });

  f.kicker(100, 228, 'signal sent to the group');
  f.box({ x: 20, y: 242, w: 180, h: 50, hue: 'rose', title: 'scheduler_0 exit -15', sub: ['the child dies first'] });
  f.box({ x: 260, y: 242, w: 180, h: 50, hue: 'rose', title: 'SIGQUIT', sub: ['kill_process_tree'], double: true });
  f.line(75, 92, 75, 241, { style: 'fail' });
  f.arrow([200, 267], [259, 267], { style: 'fail' });
  f.step(91, 170, 5, { hue: 'rose' });
  f.step(230, 252, 6, { hue: 'rose' });

  key.forEach(([line, style], index) => {
    const y = 326 + index * 17;
    f.step(30, y - 4, index + 1, { hue: style === 'fail' ? 'rose' : 'amber' });
    f.text(48, y, line, { size: 11, serif: true, hue: 'ink-soft' });
  });
});
