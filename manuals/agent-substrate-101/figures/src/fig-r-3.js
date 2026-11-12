'use strict';

const { figure } = require('../../../_shared/figkit.js');

const key = [
  ['CreateActor: a new actor starts SUSPENDED, with the golden snapshot', 'ink'],
  ['ResumeActor, from the router on each request or from a caller', 'amber'],
  ['the sandbox is restored and the wakeup probe passed', 'amber'],
  ['SuspendActor: the worker writes a checkpoint', 'amber'],
  ['the snapshot is on the node (async) or in the bucket (sync)', 'amber'],
  ['the sandbox died, the worker pod went away, or the kernel killed it', 'rose'],
  ['the resume failed, for example with no snapshot on the node', 'rose'],
  ['RevertActor, from CRASHED or from RUNNING', 'amber'],
  ['the actor is back at its last durable snapshot', 'amber'],
];

module.exports = figure('fig-r-3', {
  height: 558,
  title: 'The seven states of an actor',
  desc: 'An actor is created SUSPENDED. ResumeActor moves it through RESUMING to RUNNING, and SuspendActor moves it through SUSPENDING back to SUSPENDED. A sandbox death or a failed resume moves it to CRASHED, and RevertActor moves it through REVERTING to SUSPENDED. DeleteActor moves an actor in any state to DELETING.',
}, f => {
  f.box({ x: 20, y: 46, w: 130, h: 46, hue: 'amber', title: 'SUSPENDED', sub: ['holds no worker'] });
  f.box({ x: 205, y: 46, w: 120, h: 46, hue: 'amber', title: 'RESUMING', sub: ['worker bound'], dash: 'dashed' });
  f.box({ x: 380, y: 46, w: 120, h: 46, hue: 'amber', title: 'RUNNING', sub: ['serves requests'] });
  f.box({ x: 205, y: 140, w: 120, h: 46, hue: 'amber', title: 'SUSPENDING', sub: ['checkpoint'], dash: 'dashed' });
  f.box({ x: 530, y: 140, w: 90, h: 46, hue: 'rose', title: 'CRASHED', sub: ['503'] });
  f.box({ x: 205, y: 234, w: 120, h: 46, hue: 'amber', title: 'REVERTING', sub: ['to durable'], dash: 'dashed' });
  f.box({ x: 500, y: 296, w: 120, h: 46, hue: 'grey', title: 'DELETING', sub: ['from any state'], double: true });

  f.line(85, 14, 85, 45, {});
  f.arrow([150, 69], [204, 69], { style: 'state' });
  f.arrow([325, 69], [379, 69], { style: 'state' });
  f.path('M440 92 V163 H326', { style: 'state' });
  f.path('M205 163 H110 V93', { style: 'state' });
  f.path('M500 69 H560 V139', { style: 'fail' });
  f.path('M265 46 V26 H600 V139', { style: 'fail' });
  f.path('M575 186 V267 H326', { style: 'state' });
  f.path('M470 92 V247 H326', { style: 'state' });
  f.path('M205 257 H50 V93', { style: 'state' });

  f.step(101, 28, 1, {});
  f.step(177, 53, 2, { hue: 'amber' });
  f.step(352, 53, 3, { hue: 'amber' });
  f.step(383, 149, 4, { hue: 'amber' });
  f.step(160, 149, 5, { hue: 'amber' });
  f.step(530, 53, 6, { hue: 'rose' });
  f.step(430, 13, 7, { hue: 'rose' });
  f.step(400, 233, 8, { hue: 'amber' });
  f.step(128, 243, 9, { hue: 'amber' });

  key.forEach(([line, hue], index) => {
    const y = 374 + index * 17;
    f.step(30, y - 4, index + 1, { hue });
    f.text(48, y, line, { size: 11, serif: true, hue: 'ink-soft' });
  });
  f.text(20, 532, 'dashed border: a state that a workflow passes through', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 548, 'double border: the record is removed next', { size: 11, serif: true, hue: 'ink-soft' });
});
