'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/tokens-mac.json'));
const tasks = ['trivial', 'tools', 'files'];
const harnesses = [['plain', 'plain', 'olive'], ['create_agent', 'agent', 'blue'], ['deep_agent', 'deep', 'violet']];
const cell = (task, harness) => data.cells[`${task} ${harness}`];

module.exports = figure('fig-6-3', {
  height: 414,
  title: 'Prompt tokens of each model call, three harnesses',
  desc: `A dot chart of the prompt tokens of each model call on the Mac with Qwen3 8B, three runs of each task and harness. For the trivial task the plain loop and create_agent sent ${cell('trivial', 'plain').prompt_tokens_per_call[0][0]} tokens and Deep Agents sent ${cell('trivial', 'deep_agent').prompt_tokens_per_call[0][0]}. For the tools task the calls were ${cell('tools', 'plain').prompt_tokens_per_call[0].join(' and ')} against ${cell('tools', 'deep_agent').prompt_tokens_per_call[0].join(' and ')}. For the files task they were ${cell('files', 'plain').prompt_tokens_per_call[0].join(', ')} against ${cell('files', 'deep_agent').prompt_tokens_per_call[0].join(', ')}. create_agent sent the same count as the plain loop on every call.`,
}, f => {
  const c = chart(f, { x: 70, y: 56, w: 540, h: 250, xDomain: [0, 12], yDomain: [0, 2600], yTicks: [0, 500, 1000, 1500, 2000, 2500], yLabel: 'prompt tokens per model call' });
  tasks.forEach((task, t) => {
    const base = t * 4;
    f.kicker(c.px(base + 2), 22, task, { anchor: 'middle' });
    if (t) f.rule(c.px(base), 56, c.px(base), 306, { hue: 'ink-mute', dash: 'dashed' });
    harnesses.forEach(([key, short, hue], h) => {
      const slot = base + 1 + h;
      const runs = cell(task, key).prompt_tokens_per_call;
      runs.forEach((calls, run) => calls.forEach((tokens, i) => f.dot(c.px(slot) + (i - (calls.length - 1) / 2) * 9, c.py(tokens), { hue, r: 2.4 + run * 0.6 })));
      const total = cell(task, key).prompt_tokens_total[0];
      const top = Math.max(...runs[0]);
      f.text(c.px(slot), c.py(top) - 9, String(total), { size: 11, anchor: 'middle', hue, knock: true });
      f.text(c.px(slot), 324, short, { size: 11, anchor: 'middle', hue: 'ink-soft' });
    });
  });
  f.text(70, 350, 'Each dot is one model call. Calls of one run sit side by side.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(70, 368, 'The three runs of a cell overlap, because every repeat sent the same count.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(70, 386, 'The number over a cell is the prompt total of one run.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(70, 404, 'plain: an ollama loop. agent: create_agent. deep: create_deep_agent.', { size: 11, serif: true, hue: 'ink-soft' });
});
