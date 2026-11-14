'use strict';

const { figure } = require('../../../_shared/figkit.js');

const groups = [
  { x: 20, w: 210, title: 'wrap_model_call only', hue: 'plum', items: [['ContextEditingMiddleware'], ['ModelRetryMiddleware'], ['ModelFallbackMiddleware'], ['ModelRefusalMiddleware'], ['LLMToolSelectorMiddleware'], ['ProviderToolSearchMiddleware']] },
  { x: 250, w: 180, title: 'wrap_tool_call only', hue: 'green', items: [['ToolRetryMiddleware'], ['ToolErrorMiddleware'], ['LLMToolEmulator'], ['AutoModeMiddleware']] },
  { x: 440, w: 180, title: 'node hooks', hue: 'blue', items: [
    ['SummarizationMiddleware', 'before_model'],
    ['HumanInTheLoopMiddleware', 'after_model, wrap_tool_call'],
    ['ModelCallLimitMiddleware', 'before_model, after_model'],
    ['ToolCallLimitMiddleware', 'after_model'],
    ['PIIMiddleware', 'before_model, after_model'],
    ['TodoListMiddleware', 'after_model, wrap_model_call'],
    ['ModelRouterMiddleware', 'before_agent, wrap_model_call'],
    ['ShellToolMiddleware', 'before_agent, after_agent'],
  ] },
];

module.exports = figure('fig-3-4', {
  height: 440,
  title: 'The 19 built-in middleware classes by hook',
  desc: 'A tree with the root langchain.agents.middleware and four branches. wrap_model_call only: ContextEditingMiddleware, ModelRetryMiddleware, ModelFallbackMiddleware, ModelRefusalMiddleware, LLMToolSelectorMiddleware, ProviderToolSearchMiddleware. wrap_tool_call only: ToolRetryMiddleware, ToolErrorMiddleware, LLMToolEmulator, AutoModeMiddleware. Node hooks: SummarizationMiddleware, HumanInTheLoopMiddleware, ModelCallLimitMiddleware, ToolCallLimitMiddleware, PIIMiddleware, TodoListMiddleware, ModelRouterMiddleware, ShellToolMiddleware. Tools only: FilesystemFileSearchMiddleware.',
}, f => {
  const root = f.box({ x: 320, y: 12, w: 300, h: 40, hue: 'blue', title: 'langchain.agents.middleware', sub: '19 classes at langchain 1.5.0', anchor: 'middle', titleSize: 12 });
  f.rule(125, 70, 530, 70, { hue: 'ink-mute' });
  f.rule(320, root.y + root.h, 320, 70, { hue: 'ink-mute' });
  const tools = { x: 20, w: 210, title: 'tools only', hue: 'grey', items: [['FilesystemFileSearchMiddleware']] };
  const draw = (g, top) => {
    const box = f.box({ x: g.x, y: top, w: g.w, h: 30, hue: g.hue, title: `${g.title} (${g.items.length})`, titleSize: 11 });
    let y = top + 30;
    const stem = g.x + 8;
    g.items.forEach(([name, hooks]) => {
      const rowH = hooks ? 38 : 22;
      f.rule(stem, y, stem, y + 14, { hue: 'ink-mute' });
      f.rule(stem, y + 14, stem + 10, y + 14, { hue: 'ink-mute' });
      f.text(stem + 12, y + 18, name, { size: 11 });
      if (hooks) f.text(stem + 12, y + 33, hooks, { size: 11, serif: true, hue: 'ink-soft' });
      if (g.items[g.items.length - 1][0] !== name) f.rule(stem, y + 14, stem, y + rowH, { hue: 'ink-mute' });
      y += rowH;
    });
    return { box, bottom: y };
  };
  let firstBottom = 0;
  groups.forEach(g => {
    f.rule(g.x + g.w / 2, 70, g.x + g.w / 2, 84, { hue: 'ink-mute' });
    const out = draw(g, 84);
    if (g.x === 20) firstBottom = out.bottom;
  });
  const toolsTop = firstBottom + 26;
  f.rule(238, 70, 238, toolsTop + 15, { hue: 'ink-mute' });
  f.rule(230, toolsTop + 15, 238, toolsTop + 15, { hue: 'ink-mute' });
  draw(tools, toolsTop);
});
