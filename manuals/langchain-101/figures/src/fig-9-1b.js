'use strict';

const fs = require('fs');
const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const gl = require('../../../_shared/graphviz-lite.js');

const capture = fs.readFileSync(path.join(__dirname, '../../capture/out/54-draw-service-agent.txt'), 'utf8');
const graph = gl.fromCapture(capture, 'get_graph().draw_mermaid()');
const s = gl.summary(graph);
const hooks = s.names.filter(name => name.includes('.'));
const tools = graph.nodes.get('tools').meta.replace(/^__tools = /, '').split(', ');
const hue = node => (node.id === 'model' ? 'plum' : node.id === 'tools' ? 'green' : node.id.includes('.') ? 'blue' : 'indigo');
const plan = gl.layout(graph, { top: 44, hue, metaMax: 240 });

module.exports = figure('fig-9-1b', {
  height: plan.bottom + 44,
  title: 'The graph of the service agent',
  desc: `The compiled graph of build_agent in the reference service, drawn from its draw_mermaid output. It has ${s.nodes} nodes, ${hooks.length} of them hook nodes: ${hooks.join(', ')}. The other middleware have only wrap hooks and add no node. ModelCallLimitMiddleware can end the run before model or after it. The tools node holds ${tools.length} tools: ${tools.join(', ')}.`,
}, f => {
  f.kicker(20, 20, 'get_graph() of build_agent');
  f.text(620, 20, `${s.nodes} nodes, ${hooks.length} of them hooks`, { size: 11, anchor: 'end', hue: 'ink-soft' });
  gl.draw(f, plan);
  gl.legend(f, plan.bottom + 30);
});
