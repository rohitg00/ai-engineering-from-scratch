'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-1-2b', {
  height: 330,
  title: 'The runs of one traced agent turn',
  desc: 'A tree of eight runs. The root is the chain run agent_turn, the traceable function of the kit. Under it is the chain run LangGraph. Under that are three chain runs in order: model, tools, and model. The first model run has one llm leaf ScriptedChatModel, the tools run has one tool leaf add, and the second model run has one llm leaf ScriptedChatModel. The client got one POST /runs and one PATCH for each of the seven runs below agent_turn, which stayed in memory.',
}, f => {
  const node = (cx, y, type, name, hue) => f.box({ x: cx, y, w: 168, h: 44, hue, title: name, sub: type, anchor: 'middle', titleSize: 12 });
  const root = node(320, 14, 'chain run', 'agent_turn', 'violet');
  const graph = node(320, 92, 'chain run', 'LangGraph', 'indigo');
  f.line(320, root.y + root.h, 320, graph.y - 1, { style: 'call', head: false });
  const xs = [118, 320, 522];
  const names = ['model', 'tools', 'model'];
  xs.forEach((x, i) => {
    const chain = node(x, 172, 'chain run', names[i], 'indigo');
    f.path(`M320 ${graph.y + graph.h} L320 158 L${x} 158 L${x} ${chain.y - 1}`, { style: 'call', head: false });
    const leaf = i === 1 ? node(x, 252, 'tool run', 'add', 'green') : node(x, 252, 'llm run', 'ScriptedChatModel', 'plum');
    f.line(x, chain.y + chain.h, x, leaf.y - 1, { style: 'call', head: false });
  });
  f.text(20, 322, 'the 7 runs below agent_turn: POST /runs 7 times, PATCH 7 times', { size: 11, serif: true, hue: 'ink-soft' });
});
