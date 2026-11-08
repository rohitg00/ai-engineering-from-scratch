'use strict';

const { figure, color } = require('../figkit.js');

module.exports = figure('tpl-flow', {
  height: 212,
  title: 'Every change passes one queue',
  desc: 'Three writers on the left feed one queue of four stages, prepare, store, adopt and publish; three readers on the right see only what the queue publishes. Effects run below the queue and come back as new commits.',
}, f => {
  f.kicker(20, 18, 'Who writes');
  f.kicker(176, 18, 'One commit at a time');
  f.kicker(530, 18, 'Who reads');
  [['host', 'submit()', 30], ['task step', 'commit()', 76], ['tool', 'api.commit()', 122]].forEach(([title, sub, y]) => {
    f.box({ x: 20, y, w: 130, h: 38, hue: 'grey', title, sub });
    f.path(`M150 ${y + 19} H163 V93 H175`, { style: 'call' });
  });
  f.rect(176, 58, 330, 70, { hue: 'teal' });
  const stages = [['prepare', 'drafts'], ['store', 'settles'], ['adopt', 'revision'], ['publish', 'enqueue']];
  stages.forEach(([title, sub], index) => {
    const x = 184 + index * 82;
    f.box({ x, y: 70, w: 72, h: 46, hue: index === 1 ? 'teal' : 'grey', title, sub, titleSize: 12, pad: 8 });
    if (index < stages.length - 1) f.line(x + 72, 93, x + 81, 93, { style: 'write' });
  });
  [['watch()', 'frames', 30], ['wait()', 'records', 76], ['snapshot()', 'value', 122]].forEach(([title, sub, y]) => {
    f.box({ x: 530, y, w: 90, h: 38, hue: 'indigo', title, sub, pad: 8, titleSize: 12 });
    f.path(`M506 93 H518 V${y + 19} H529`, { style: 'event' });
  });
  f.box({ x: 196, y: 160, w: 290, h: 42, hue: 'olive', title: 'effects: model calls, tools', sub: 'off the queue, back as commits' });
  f.arrow([300, 159], [300, 129], { style: 'effect', label: 'a new commit' });
});
