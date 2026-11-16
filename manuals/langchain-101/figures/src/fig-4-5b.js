'use strict';

const fs = require('fs');
const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const gl = require('../../../_shared/graphviz-lite.js');

const capture = fs.readFileSync(path.join(__dirname, '../../capture/out/49-draw-middleware.txt'), 'utf8');
const graph = gl.fromCapture(capture, 'get_graph().draw_mermaid()');
const s = gl.summary(graph);
const hooks = s.names.filter(name => name.includes('.'));
const hue = node => (node.id === 'model' ? 'plum' : node.id === 'tools' ? 'green' : node.id.includes('.') ? 'blue' : 'indigo');
const plan = gl.layout(graph, { top: 40, hue });

module.exports = figure('fig-4-5b', {
  height: plan.bottom + 40,
  title: 'The graph of middleware A, B, and C',
  desc: `The compiled graph of create_agent with tools=[add] and middleware=[A, B, C], drawn from its draw_mermaid output. It has ${s.nodes} nodes, ${hooks.length} of them hook nodes, and ${s.edges} edges, ${s.conditional} of them conditional. The before hooks run A, B, C from the top. The after_model hooks run C, B, A under model. A.after_model has three conditional edges: to tools, to C.after_agent, and back to A.before_model. tools goes back to A.before_model.`,
}, f => {
  f.kicker(20, 18, 'get_graph() of the agent');
  f.text(620, 18, `${s.nodes} nodes, ${hooks.length} of them hooks`, { size: 11, anchor: 'end', hue: 'ink-soft' });
  gl.draw(f, plan);
  gl.legend(f, plan.bottom + 28);
});
