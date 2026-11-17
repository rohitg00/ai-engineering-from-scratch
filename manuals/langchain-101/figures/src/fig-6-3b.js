'use strict';

const fs = require('fs');
const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const gl = require('../../../_shared/graphviz-lite.js');

const capture = fs.readFileSync(path.join(__dirname, '../../capture/out/51-draw-functional.txt'), 'utf8');
const graph = gl.fromCapture(capture, 'get_graph().draw_mermaid()');
const s = gl.summary(graph);
const plan = gl.layout(graph, { top: 44 });
const node = plan.boxes.get('workflow');

module.exports = figure('fig-6-3b', {
  height: plan.bottom + 44,
  title: 'The graph of an entrypoint',
  desc: `The graph of the workflow entrypoint, drawn from its draw_mermaid output. It has ${s.nodes} nodes: ${s.names.join(', ')}. A plain edge goes from __start__ to workflow and a conditional edge goes from workflow to __end__. The tasks double and ask_human run inside the workflow node and are not in the graph.`,
}, f => {
  f.kicker(20, 20, 'get_graph() of an @entrypoint');
  f.text(620, 20, `${s.nodes} nodes, no task nodes`, { size: 11, anchor: 'end', hue: 'ink-soft' });
  gl.draw(f, plan);
  f.text(node.x + node.w + 20, node.y + 16, 'double and ask_human run in here', { size: 11, serif: true, hue: 'ink-soft' });
  gl.legend(f, plan.bottom + 30);
});
