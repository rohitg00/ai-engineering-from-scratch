'use strict';

const { figure } = require('../../../_shared/figkit.js');

const chain = [
  ['A.before_model', 'blue'], ['B.before_model', 'blue'], ['C.before_model', 'blue'],
  ['model', 'indigo'],
  ['C.after_model', 'blue'], ['B.after_model', 'blue'], ['A.after_model', 'blue'],
];

module.exports = figure('fig-3-3', {
  height: 470,
  title: 'The order of hooks from three middlewares',
  desc: 'Two panels for middleware=[A, B, C]. The left panel is the chain of graph nodes for one model call: A.before_model, B.before_model, C.before_model, model, C.after_model, B.after_model, A.after_model, then tools or the end. The right panel is the model node with three nested wrap_model_call layers: A outside, then B, then C, then the model call. The request enters A, B, C in that order and the response leaves C, B, A.',
}, f => {
  f.kicker(20, 20, 'graph nodes, one model call');
  chain.forEach(([name, hue], i) => {
    const y = 34 + i * 54;
    f.box({ x: 40, y, w: 200, h: 34, hue, title: name, titleSize: 12 });
    if (i < chain.length - 1) f.arrow([140, y + 34], [140, y + 53], { style: 'call' });
  });
  const last = 34 + (chain.length - 1) * 54 + 34;
  f.arrow([140, last], [140, last + 26], { style: 'call' });
  f.text(140, last + 42, 'tools, the end, or a jump', { size: 11, serif: true, anchor: 'middle', hue: 'ink-soft' });
  f.text(256, 34 + 54 + 22, 'list order', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(256, 34 + 5 * 54 + 22, 'reverse order', { size: 11, serif: true, hue: 'ink-soft' });

  f.kicker(340, 20, 'inside the model node');
  const layers = [['A.wrap_model_call', 340, 34, 280, 300], ['B.wrap_model_call', 360, 70, 240, 228], ['C.wrap_model_call', 380, 106, 200, 156]];
  layers.forEach(([name, x, y, w, h]) => {
    f.rect(x, y, w, h, { hue: 'blue' });
    f.text(x + 10, y + 18, name, { size: 11.5, hue: 'blue', weight: 700 });
  });
  f.box({ x: 410, y: 150, w: 140, h: 70, hue: 'plum', title: 'model called', sub: 'the chat model' });
  f.text(350, 368, 'enters A, B, C, exits C, B, A', { size: 11.5, hue: 'ink' });
  f.text(350, 388, 'A sees the request first', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(350, 406, 'and the response last.', { size: 11, serif: true, hue: 'ink-soft' });
});
