'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-2-2', {
  height: 340,
  title: 'How init_chat_model resolves a model string',
  desc: 'A decision figure with three tests in order. First, is the part before the first colon a known provider? openai:gpt-4.1 and ollama:qwen3:4b say yes and build ChatOpenAI and ChatOllama. Second, does the name start with a known prefix such as gpt-, o3, or claude? gpt-4.1-mini and claude-haiku-4-5 say yes and build ChatOpenAI and ChatAnthropic. Third, any other string such as qwen3:4b raises ValueError: Unable to infer model provider, before any request.',
}, f => {
  const test = (y, title, sub) => f.box({ x: 20, y, w: 260, h: 56, hue: 'blue', title, sub, align: 'left' });
  const out = (y, title, sub, hue) => f.box({ x: 360, y, w: 260, h: 56, hue, title, sub, align: 'left' });
  const t1 = test(20, 'known provider prefix?', 'the part before the first colon');
  const o1 = out(20, 'ollama:qwen3:4b', 'ChatOllama, model qwen3:4b', 'plum');
  const t2 = test(120, 'known name start?', 'gpt-, o1, o3, claude, gemini');
  const o2 = out(120, 'claude-haiku-4-5', 'ChatAnthropic', 'plum');
  const o3 = out(220, 'qwen3:4b', 'ValueError: Unable to infer', 'rose');
  f.arrow(t1.right(), [o1.x - 1, t1.cy], { style: 'call', label: 'yes' });
  f.arrow(t2.right(), [o2.x - 1, t2.cy], { style: 'call', label: 'yes' });
  f.arrow([150, t1.y + t1.h], [150, t2.y - 1], { style: 'call', label: 'no' });
  f.path(`M150 ${t2.y + t2.h} L150 248 L${o3.x - 1} 248`, { style: 'fail' });
  f.text(158, 196, 'no', { size: 11.5 });
  f.text(20, 300, 'qwen3 is not a known provider, so only the first colon of ollama:qwen3:4b splits.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 320, 'The error comes before any request reaches a provider.', { size: 11, serif: true, hue: 'ink-soft' });
});
