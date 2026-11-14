'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-5-1', {
  height: 300,
  title: 'Two writes to one key in one step',
  desc: 'Two columns. On the left, three write_joke tasks in one step each write one joke to the key jokes, whose reducer is operator.add, and the state ends with three jokes about cats, dogs, and owls. On the right, the nodes a and b both write the key value, which has no reducer, and the run raises InvalidUpdateError at key value because the key can receive only one value per step.',
}, f => {
  f.kicker(20, 18, 'jokes, reducer operator.add');
  f.kicker(352, 18, 'value, no reducer');
  f.rule(336, 8, 336, 262, { dash: 'dashed' });
  ['cats', 'dogs', 'owls'].forEach((subject, i) => {
    const x = 20 + i * 104;
    f.box({ x, y: 32, w: 96, h: 46, hue: 'indigo', title: 'write_joke', sub: `jokes: [${subject}]`, titleSize: 11.5, pad: 6 });
    f.path(`M${x + 48} 78 V96 H156 V112`, { style: 'write', head: i === 1 });
  });
  f.box({ x: 20, y: 114, w: 296, h: 44, hue: 'indigo', title: 'operator.add', sub: 'joins the three updates in one step' });
  f.arrow([168, 158], [168, 189], { style: 'write' });
  f.box({ x: 20, y: 190, w: 296, h: 60, hue: 'teal', title: 'state: jokes, 3 items', sub: ['a joke about cats', 'a joke about dogs, a joke about owls'] });
  [['a', '"a"'], ['b', '"b"']].forEach(([node, value], i) => {
    const x = 352 + i * 140;
    f.box({ x, y: 32, w: 128, h: 46, hue: 'indigo', title: `node ${node}`, sub: `value: ${value}`, titleSize: 11.5, pad: 6 });
    f.path(`M${x + 64} 78 V96 H486 V112`, { style: 'fail', head: i === 0 });
  });
  f.box({ x: 352, y: 114, w: 268, h: 44, hue: 'grey', title: 'no reducer', sub: 'LastValue takes one write per step' });
  f.arrow([486, 158], [486, 189], { style: 'fail' });
  f.box({ x: 352, y: 190, w: 268, h: 60, hue: 'rose', title: 'InvalidUpdateError', sub: ["At key 'value': Can receive", 'only one value per step.'] });
  f.text(20, 282, 'Both runs start from one step with parallel writes. Only the reducer differs.', { size: 11, serif: true, hue: 'ink-soft' });
});
