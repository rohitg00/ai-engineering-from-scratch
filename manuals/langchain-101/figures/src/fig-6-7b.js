'use strict';

const fs = require('fs');
const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const gl = require('../../../_shared/graphviz-lite.js');

const capture = fs.readFileSync(path.join(__dirname, '../../capture/out/52-draw-subgraph.txt'), 'utf8');
const flat = gl.fromCapture(capture, 'get_graph().draw_mermaid()');
const xray = gl.fromCapture(capture, 'get_graph(xray=True).draw_mermaid()');
const a = gl.summary(flat);
const b = gl.summary(xray);
const left = gl.layout(flat, { top: 64, center: 160 });
const right = gl.layout(xray, { top: 64, center: 440 });
const bottom = Math.max(left.bottom, right.bottom);

module.exports = figure('fig-6-7b', {
  height: bottom + 44,
  title: 'One parent graph, drawn with and without xray',
  desc: `The parent graph of the subgraph example, drawn twice from draw_mermaid output. get_graph() has ${a.nodes} nodes and shows the subgraph as one node named inner. get_graph(xray=True) has ${b.nodes} nodes. It draws the subgraph as a box named inner around its nodes ${[...xray.clusters.get('inner')].join(' and ')}, and the parent edges go to inner:shout and leave from inner:ask_ok.`,
}, f => {
  f.kicker(20, 20, 'get_graph()');
  f.kicker(300, 20, 'get_graph(xray=True)');
  f.text(20, 40, `${a.nodes} nodes, inner is one node`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(300, 40, `${b.nodes} nodes, the subgraph opened`, { size: 11, serif: true, hue: 'ink-soft' });
  f.rule(280, 12, 280, bottom + 4, { dash: 'dotted' });
  gl.draw(f, left);
  gl.draw(f, right);
  gl.legend(f, bottom + 30);
});
