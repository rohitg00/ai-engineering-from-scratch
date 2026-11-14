'use strict';

const { figure } = require('../../../_shared/figkit.js');

const rows = [
  ['model', 'a string or a chat model', 'model node', 'calls the chat model', 'indigo'],
  ['tools', 'functions and BaseTool', 'tools node', 'one Send for each tool call', 'green'],
  ['system_prompt', 'a string or SystemMessage', 'each model call', 'first message, not in state', 'plum'],
  ['middleware', '[A, B, C]', 'A.before_model and more', 'a node per hook, wraps run inside', 'blue'],
  ['response_format', 'a schema or a strategy', 'each model call', 'a structured tool or a format', 'plum'],
  ['checkpointer', 'InMemorySaver', 'checkpoints', 'one after each step', 'teal'],
];

module.exports = figure('fig-3-1', {
  height: 500,
  title: 'What each argument of create_agent builds',
  desc: 'Six rows map an argument of create_agent to the part of the compiled graph it builds. model builds the model node. tools builds the tools node, with one Send for each tool call. system_prompt and response_format change each model call and add no node. middleware builds hook nodes such as A.before_model, with wrap hooks inside the model and tools nodes. checkpointer saves one checkpoint after each step. A band at the bottom shows the config create_agent sets on every agent: recursion_limit 9999, stream_mode updates, and the ls_integration metadata.',
}, f => {
  f.kicker(20, 20, 'argument of create_agent');
  f.kicker(360, 20, 'what the compiled graph gets');
  rows.forEach(([arg, example, part, note, hue], i) => {
    const y = 34 + i * 64;
    const left = f.box({ x: 20, y, w: 230, h: 50, hue: 'violet', title: arg, sub: example, align: 'left' });
    const right = f.box({ x: 360, y, w: 260, h: 50, hue, title: part, sub: note, align: 'left' });
    f.arrow(left.right(), [right.x - 1, left.cy], { style: hue === 'teal' ? 'write' : 'call' });
  });
  f.box({ x: 20, y: 432, w: 600, h: 50, hue: 'blue', title: 'with_config on every agent', sub: 'recursion_limit 9999, stream_mode updates, ls_integration langchain_create_agent', align: 'left' });
});
