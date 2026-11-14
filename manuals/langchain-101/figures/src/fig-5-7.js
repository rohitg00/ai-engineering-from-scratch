'use strict';

const { figure } = require('../../../_shared/figkit.js');

const rows = [
  ['prepare', 'outer', ['outer.prepare']],
  ['shout', 'inner', ['outer.prepare', 'inner.shout']],
  ['ask_ok', 'inner', ['outer.prepare', 'inner.shout', 'inner.ask_ok=yes']],
  ['operator.add', 'parent update', ['outer.prepare', '+', 'outer.prepare*', 'inner.shout', 'inner.ask_ok=yes']],
  ['finish', 'outer', ['outer.prepare', 'outer.prepare*', 'inner.shout', 'inner.ask_ok=yes', 'outer.finish']],
];

module.exports = figure('fig-5-7', {
  height: 380,
  title: 'The steps list through a subgraph',
  desc: 'Five rows from top to bottom, each a node and the steps list after it. prepare writes outer.prepare. Inside the namespace of the subgraph inner, shout adds inner.shout and ask_ok adds inner.ask_ok=yes, so the subgraph returns three entries. The parent applies that output with operator.add to its list that already holds outer.prepare, so outer.prepare appears twice. finish adds outer.finish, and the final list has five entries.',
}, f => {
  f.kicker(20, 18, 'node');
  f.kicker(128, 18, 'steps after the node');
  f.rect(10, 92, 620, 126, { hue: 'indigo', dash: 'dashed', fill: 'none' });
  f.text(620, 210, 'namespace inner:<uuid-1>', { size: 11, anchor: 'end', hue: 'indigo', serif: true });
  rows.forEach(([node, where, items], i) => {
    const y = 32 + i * 66;
    const hue = where === 'parent update' ? 'grey' : 'indigo';
    f.box({ x: 16, y, w: 100, h: 42, hue, title: node, sub: where, titleSize: 11.5, pad: 4 });
    if (i < rows.length - 1) f.arrow([66, y + 42], [66, y + 65], { style: 'call' });
    let x = 128;
    items.forEach(item => {
      if (item === '+') {
        f.text(x + 3, y + 26, '+', { size: 13, weight: 700, hue: 'ink-soft' });
        x += 16;
        return;
      }
      const copy = item.endsWith('*');
      const text = copy ? item.slice(0, -1) : item;
      const w = Math.ceil(text.length * 11 * 0.6) + 8;
      f.rect(x, y + 10, w, 24, { hue: copy ? 'rose' : 'teal' });
      f.text(x + 4, y + 26, text, { size: 11, hue: copy ? 'rose' : undefined });
      x += w + 6;
    });
  });
  f.text(20, 372, 'The rose entry is the copy that operator.add in the parent added to its own list.', { size: 11, serif: true, hue: 'ink-soft' });
});
