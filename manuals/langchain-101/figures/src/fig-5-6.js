'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/replay-fork-mac.json'));
const byId = Object.fromEntries(data.tree.map(node => [node.id, node]));
const children = id => data.tree.filter(node => node.parent === id);
const label = node => `step ${node.step}, ${node.source}`;
const sub = node => `x = ${node.x === null ? 'none' : node.x}, next ${node.next.length ? node.next.join(', ') : 'none'}`;

module.exports = figure('fig-5-6', {
  height: 400,
  title: 'Three branches of one thread',
  desc: `A tree of the ${data.tree.length} checkpoints of one thread. The first run saved steps -1 to 3 with x from none to 3. From the checkpoint at step 1, whose next node is b, a replay added a fork checkpoint at step 2 with x 1 and two loop checkpoints that end with x 3. update_state on the same checkpoint added an update checkpoint at step 2 with x 100, and the run from it ended with x 102. Every old checkpoint stayed.`,
}, f => {
  const box = (node, cx, y, hue) => f.box({ x: cx, y, w: 176, h: 42, hue, title: label(node), sub: sub(node), anchor: 'middle', titleSize: 12 });
  const trunk = ['c0', 'c1', 'c2'];
  trunk.forEach((id, i) => {
    box(byId[id], 320, 12 + i * 60, 'teal');
    if (i) f.line(320, 12 + i * 60 - 18, 320, 12 + i * 60 - 1, { style: 'write' });
  });
  const branches = children('c2').sort((a, b) => ['loop', 'fork', 'update'].indexOf(a.source) - ['loop', 'fork', 'update'].indexOf(b.source));
  const xs = [112, 320, 528];
  const names = ['the first run', 'the replay', 'update_state'];
  branches.forEach((head, i) => {
    f.path(`M320 ${12 + 2 * 60 + 42} V178 H${xs[i]} V${200 - 1}`, { style: 'write' });
    f.text(xs[i], 192, names[i].toUpperCase(), { size: 11, spacing: 1.2, hue: 'ink-mute', anchor: 'middle', knock: true });
    let node = head;
    let y = 200;
    while (node) {
      const hue = node.source === 'fork' ? 'amber' : node.source === 'update' ? 'violet' : 'teal';
      box(node, xs[i], y, hue);
      const next = children(node.id)[0];
      if (next) f.line(xs[i], y + 42, xs[i], y + 59, { style: 'write' });
      node = next;
      y += 60;
    }
  });
  f.text(20, 392, 'Each box is one checkpoint from one run on the Mac. Old checkpoints are never removed.', { size: 11, serif: true, hue: 'ink-soft' });
});
