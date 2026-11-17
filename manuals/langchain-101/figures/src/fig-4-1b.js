'use strict';

const fs = require('fs');
const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const gl = require('../../../_shared/graphviz-lite.js');

const capture = fs.readFileSync(path.join(__dirname, '../../capture/out/48-draw-agent.txt'), 'utf8');
const heading = 'get_graph().draw_mermaid()';
const graph = gl.fromCapture(capture, heading);
const block = capture.slice(capture.indexOf(`## ${heading}`), capture.indexOf('\n## ', capture.indexOf(`## ${heading}`) + 4));
const rows = block.split('\n').filter(line => line.startsWith('\t') && !line.includes('classDef')).map(line => line.trim());
const isEdge = line => / -->? | -\.-> /.test(line);
const nodeRows = rows.filter(line => !isEdge(line));
const edgeRows = rows.filter(isEdge);
const hue = node => (node.id === 'model' ? 'plum' : node.id === 'tools' ? 'green' : 'indigo');
const plan = gl.layout(graph, { top: 60, center: 520, hue });
const s = gl.summary(graph);

module.exports = figure('fig-4-1b', {
  height: 310,
  title: 'From draw_mermaid lines to a drawing',
  desc: `The draw_mermaid output of the agent with one tool, line by line, next to the drawing it describes. ${nodeRows.length} node lines give each node an id and a label: the :::first and :::last classes mark __start__ and __end__, and the label of tools carries the metadata __tools = add. ${edgeRows.length} edge lines follow: --> is a plain edge and -.-> is a conditional edge. The drawing has ${s.nodes} nodes, ${s.plain} plain edge, and ${s.conditional} conditional edges.`,
}, f => {
  f.kicker(20, 20, 'the lines of draw_mermaid()');
  f.kicker(420, 20, 'the drawing');
  let y = 50;
  f.text(20, y, 'node lines: id(label), number matches the drawing', { size: 11, serif: true, hue: 'ink-soft' });
  y += 22;
  nodeRows.forEach((line, i) => {
    f.step(30, y - 4, i + 1, { hue: 'indigo' });
    f.text(46, y, line, { size: 11, max: 360 });
    y += 24;
  });
  y += 6;
  f.text(20, y, 'edge lines: --> plain, -.-> conditional', { size: 11, serif: true, hue: 'ink-soft' });
  y += 22;
  for (const line of edgeRows) {
    const conditional = line.includes('-.->');
    f.line(20, y - 4, 40, y - 4, { style: conditional ? 'state' : 'call' });
    f.text(46, y, line, { size: 11, hue: conditional ? 'amber' : undefined });
    y += 20;
  }
  gl.draw(f, plan);
  nodeRows.forEach((line, i) => {
    const id = /^([^(]+)\(/.exec(line)[1];
    const box = plan.boxes.get(id);
    f.step(box.x - 14, box.y + box.h / 2, i + 1, { hue: 'indigo' });
  });
  f.text(20, y + 8, 'The frontmatter and the classDef lines only set the style.', { size: 11, serif: true, hue: 'ink-soft' });
});
