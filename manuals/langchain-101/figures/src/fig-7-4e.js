'use strict';

const fs = require('fs');
const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const gl = require('../../../_shared/graphviz-lite.js');

const capture = fs.readFileSync(path.join(__dirname, '../../capture/out/53-draw-deep-agent.txt'), 'utf8');
const graph = gl.fromCapture(capture, 'get_graph().draw_mermaid()');
const s = gl.summary(graph);
const tools = graph.nodes.get('tools').meta.replace(/^__tools = /, '').split(', ');
const hue = node => (node.id === 'model' ? 'plum' : node.id === 'tools' ? 'green' : node.id.includes('.') ? 'blue' : 'indigo');
const plan = gl.layout(graph, { top: 44, hue, metaMax: 250 });
const loops = graph.edges.filter(e => e.from === e.to).map(e => e.from);

module.exports = figure('fig-7-4e', {
  height: plan.bottom + 44,
  title: 'The graph of a deep agent',
  desc: `The compiled graph of create_deep_agent with tools=[add], drawn from its draw_mermaid output. It has ${s.nodes} nodes. PatchToolCallsMiddleware.before_agent runs before model, and _ParentNotifierMiddleware.after_agent runs before the end. The tools node holds ${tools.length} tools: ${tools.join(', ')}. The ${loops.join(', ')} node also has a conditional edge back to itself.`,
}, f => {
  f.kicker(20, 20, 'get_graph() of create_deep_agent');
  f.text(620, 20, `${s.nodes} nodes, ${tools.length} tools`, { size: 11, anchor: 'end', hue: 'ink-soft' });
  gl.draw(f, plan);
  gl.legend(f, plan.bottom + 30);
});
