'use strict';

const fs = require('fs');
const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const gl = require('../../../_shared/graphviz-lite.js');

const capture = fs.readFileSync(path.join(__dirname, '../../capture/out/48-draw-agent.txt'), 'utf8');
const graph = gl.fromCapture(capture, 'get_graph().draw_mermaid()');
const s = gl.summary(graph);
const hue = node => (node.id === 'model' ? 'plum' : node.id === 'tools' ? 'green' : 'indigo');
const plan = gl.layout(graph, { top: 44, hue });

module.exports = figure('fig-1-3c', {
  height: plan.bottom + 44,
  title: 'The graph of the agent in this run',
  desc: `The compiled graph of create_agent with one tool, drawn from its draw_mermaid output. It has ${s.nodes} nodes: ${s.names.join(', ')}. One plain edge goes from __start__ to model. Three conditional edges go from model to tools, from model to __end__, and from tools back to model. The tools node lists the tool add.`,
}, f => {
  f.kicker(20, 20, 'the compiled graph');
  f.text(620, 20, `${s.nodes} nodes, ${s.plain} plain edge, ${s.conditional} conditional`, { size: 11, anchor: 'end', hue: 'ink-soft' });
  gl.draw(f, plan);
  gl.legend(f, plan.bottom + 30);
});
