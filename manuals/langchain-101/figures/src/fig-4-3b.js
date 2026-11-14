'use strict';

const { figure } = require('../../../_shared/figkit.js');

const lanes = [
  { title: 'graph loop', sub: 'Pregel, sync', hue: 'indigo', x: 220 },
  { title: 'nodes', sub: 'effect, finish', hue: 'indigo', x: 340 },
  { title: 'sink file', sub: 'outside', hue: 'olive', x: 460 },
  { title: 'checkpointer', sub: 'two savers', hue: 'teal', x: 580 },
];
const rows = [
  [0, 1, 'call', 'run effect', '1 before_tool'],
  [1, 2, 'effect', 'append, fsync', '2 inside_tool'],
  [1, 0, 'reply', 'return writes', '3 before_put_writes'],
  [0, 3, 'write', 'put_writes', '4 before_put'],
  [0, 3, 'write', 'put, the step', null],
  [0, 1, 'call', 'run finish', '5 after_tool'],
];

module.exports = figure('fig-4-3b', {
  height: 470,
  title: 'The five kill points in the step of the effect node',
  desc: 'Four lifelines: the graph loop, the nodes, the sink file outside the graph, and the checkpointer. Six rows: the loop runs the effect node, the node appends a line to the sink file with fsync, the node returns its writes, the loop saves them with put_writes, the loop saves the checkpoint of the step with put, and the loop runs the finish node. The kill points sit after rows 1, 2, 3, 4, and 6.',
}, f => {
  lanes.forEach(lane => {
    f.box({ x: lane.x, y: 8, w: 112, h: 40, hue: lane.hue, title: lane.title, sub: lane.sub, titleSize: 11.5, anchor: 'middle', pad: 3 });
    f.lifeline(lane.x, 48, 452);
  });
  f.kicker(20, 28, 'kill point');
  rows.forEach(([from, to, style, label, kill], i) => {
    const y = 84 + i * 62;
    f.beat(i + 1);
    const x1 = lanes[from].x;
    const x2 = lanes[to].x;
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label });
    if (kill) {
      const ky = y + 31;
      f.rule(160, ky, 630, ky, { hue: 'rose', dash: 'dashed', width: 1.2 });
      f.text(20, ky + 4, kill, { size: 11, hue: 'rose' });
    }
  });
});
