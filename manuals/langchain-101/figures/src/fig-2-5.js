'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-2-5', {
  height: 300,
  title: 'How the model node builds each request',
  desc: 'A flow from left to right. The system prompt You add numbers., set when the agent is built, and the messages channel of the state, human, ai, and tool 5, both go into the model node. The model node sends system first and then the messages to the chat model as a plum model call. The reply The sum is 5. goes back into the state as a teal write. The system prompt never goes into the state.',
}, f => {
  const prompt = f.box({ x: 20, y: 30, w: 200, h: 60, hue: 'violet', title: 'system_prompt', sub: 'You add numbers.' });
  const state = f.box({ x: 20, y: 150, w: 200, h: 92, hue: 'teal', title: 'state: messages', sub: ['human: What is 2 + 3?', 'ai: tool call add', 'tool: 5'] });
  const node = f.box({ x: 270, y: 90, w: 140, h: 76, hue: 'indigo', title: 'model node', sub: ['system first,', 'then messages'] });
  const model = f.box({ x: 470, y: 98, w: 150, h: 60, hue: 'plum', title: 'chat model', sub: 'call 2' });
  f.path(`M${prompt.x + prompt.w} 60 L245 60 L245 112 L${node.x - 1} 112`, { style: 'call' });
  f.path(`M${state.x + state.w} 180 L245 180 L245 144 L${node.x - 1} 144`, { style: 'call' });
  f.line(node.x + node.w, 128, model.x - 1, 128, { style: 'model' });
  f.path(`M545 ${model.y + model.h} L545 272 L120 272 L120 ${state.y + state.h + 1}`, { style: 'write' });
  f.text(330, 266, 'reply: The sum is 5.', { size: 11.5, anchor: 'middle', hue: 'teal', knock: true });
  f.text(120, 112, 'never written', { size: 11, serif: true, anchor: 'middle', hue: 'ink-mute' });
  f.text(120, 128, 'to the state', { size: 11, serif: true, anchor: 'middle', hue: 'ink-mute' });
});
