'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/demos-mac.json')).deep_agent;
const hue = { main: 'blue', editor: 'indigo' };
const total = agent => data.totals[agent].input_tokens;

module.exports = figure('fig-8-4', {
  height: 380,
  title: 'Prompt tokens of each model call of the deep agent',
  desc: `A dot chart of the prompt tokens of the ${data.calls.length} model calls of one deep agent run on the Mac with Qwen3 8B. The main agent made ${data.totals.main.calls} calls of ${data.calls.filter(c => c.agent === 'main').map(c => c.input_tokens).join(', ')} tokens, ${total('main')} in all, with ${data.calls[0].tools} tools bound. The editor subagent made ${data.totals.editor.calls} calls of ${data.calls.filter(c => c.agent === 'editor').map(c => c.input_tokens).join(' and ')} tokens, ${total('editor')} in all, with ${data.calls.find(c => c.agent === 'editor').tools} tools bound.`,
}, f => {
  const c = chart(f, { x: 70, y: 56, w: 540, h: 220, xDomain: [0.5, 7.5], yDomain: [0, 5000], xTicks: [1, 2, 3, 4, 5, 6, 7], yTicks: [0, 1000, 2000, 3000, 4000, 5000], yLabel: 'prompt tokens of the call', xLabel: 'model call, in the order of the run' });
  data.calls.forEach(call => {
    f.dot(c.px(call.n), c.py(call.input_tokens), { hue: hue[call.agent], r: 4 });
    f.text(c.px(call.n), c.py(call.input_tokens) - 10, String(call.input_tokens), { size: 11, anchor: 'middle', hue: hue[call.agent], knock: true });
    f.text(c.px(call.n), c.py(0) - 8, call.tool_calls[0] || 'answer', { size: 11, anchor: 'middle', hue: 'ink-soft', knock: true });
  });
  f.text(c.px(1.2), c.py(4700), `main agent: ${data.totals.main.calls} calls, ${total('main')} tokens`, { size: 11.5, hue: 'blue', weight: 700 });
  f.text(c.px(3.6), c.py(1250), `editor subagent: ${data.totals.editor.calls} calls, ${total('editor')} tokens`, { size: 11.5, hue: 'indigo', weight: 700 });
  f.text(70, 334, 'The label on the axis is the tool that the call asked for.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(70, 352, `Calls 4 and 5 ran inside the task tool, with ${data.calls[3].tools} tools in place of ${data.calls[0].tools}.`, { size: 11, serif: true, hue: 'ink-soft' });
});
