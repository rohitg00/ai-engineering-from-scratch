'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-5-2', {
  height: 270,
  title: 'The joke graph and one run',
  desc: 'A flow from __start__ to plan, then three Send arrows from plan to three write_joke tasks for cats, dogs, and owls in one step, then plain edges to pick. pick returns a Command with best set to a joke about cats and goto publish, so publish runs and then __end__. The retry node, the other target of pick, did not run.',
}, f => {
  const start = f.box({ x: 12, y: 96, w: 74, h: 40, hue: 'grey', title: '__start__', titleSize: 11.5, pad: 4 });
  const plan = f.box({ x: 104, y: 96, w: 66, h: 40, hue: 'indigo', title: 'plan', sub: 'subjects', pad: 4 });
  f.arrow(start.right(), [plan.x - 1, plan.cy], { style: 'call' });
  const tasks = ['cats', 'dogs', 'owls'].map((subject, i) => f.box({ x: 206, y: 40 + i * 56, w: 102, h: 40, hue: 'indigo', title: 'write_joke', sub: subject, titleSize: 11.5, pad: 4 }));
  tasks.forEach((task, i) => {
    f.path(`M170 116 H186 V${task.cy} H205`, { style: 'state', head: true });
    f.path(`M308 ${task.cy} H324 V116 H343`, { style: 'call', head: i === 1 });
  });
  f.text(188, 30, 'Send x 3', { size: 11, hue: 'amber' });
  const pick = f.box({ x: 344, y: 96, w: 66, h: 40, hue: 'indigo', title: 'pick', sub: 'Command', pad: 4 });
  const publish = f.box({ x: 452, y: 56, w: 82, h: 40, hue: 'indigo', title: 'publish', sub: 'ran', pad: 4 });
  const retry = f.box({ x: 452, y: 150, w: 82, h: 40, hue: 'grey', title: 'retry', sub: 'did not run', dash: 'dashed', pad: 4 });
  f.path(`M410 110 H428 V76 H451`, { style: 'state' });
  f.path(`M410 122 H428 V170 H451`, { style: 'state', hue: 'grey' });
  f.text(431, 50, 'goto', { size: 11, hue: 'amber' });
  const end = f.box({ x: 560, y: 96, w: 68, h: 40, hue: 'grey', title: '__end__', titleSize: 11.5, pad: 4 });
  f.path(`M534 76 H546 V110 H559`, { style: 'call' });
  f.path(`M534 170 H546 V122 H559`, { style: 'call', hue: 'grey' });
  const steps = [[137, 'step 1'], [257, 'step 2'], [377, 'step 3'], [493, 'step 4']];
  f.rule(20, 214, 620, 214, { hue: 'ink-mute', opacity: 0.4 });
  steps.forEach(([x, label]) => f.text(x, 232, label, { size: 11, anchor: 'middle', hue: 'ink-soft' }));
  f.text(20, 258, 'pick sets best to a joke about cats, so its Command goes to publish.', { size: 11, serif: true, hue: 'ink-soft' });
});
