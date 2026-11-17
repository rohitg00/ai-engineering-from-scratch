'use strict';

const fs = require('fs');
const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const gl = require('../../../_shared/graphviz-lite.js');

const capture = fs.readFileSync(path.join(__dirname, '../../capture/out/50-draw-fanout.txt'), 'utf8');
const graph = gl.fromCapture(capture, 'get_graph().draw_mermaid()');
const s = gl.summary(graph);
const plan = gl.layout(graph, { top: 44 });
const cond = graph.edges.filter(e => e.conditional).map(e => `${e.from} to ${e.to}`);

module.exports = figure('fig-6-2b', {
  height: plan.bottom + 44,
  title: 'The joke graph as LangGraph draws it',
  desc: `The compiled joke graph drawn from its draw_mermaid output, top to bottom. It has ${s.nodes} nodes and ${s.edges} edges. The ${s.conditional} conditional edges are ${cond.join(', ')}. The edge from plan comes from add_conditional_edges with Send. The two edges from pick come from the Command return type of pick, with no add_edge call.`,
}, f => {
  f.kicker(20, 20, 'get_graph().draw_mermaid()');
  f.text(620, 20, `${s.plain} plain edges, ${s.conditional} conditional`, { size: 11, anchor: 'end', hue: 'ink-soft' });
  gl.draw(f, plan);
  const plan_ = plan.boxes.get('plan');
  const pick = plan.boxes.get('pick');
  f.text(plan_.x + plan_.w / 2 + 14, plan_.y + plan_.h + 13, 'Send: one write_joke task for each subject', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(pick.x + pick.w + 16, pick.y + 16, 'pick returns a Command', { size: 11, serif: true, hue: 'ink-soft' });
  gl.legend(f, plan.bottom + 30);
});
