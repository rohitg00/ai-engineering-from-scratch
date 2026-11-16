'use strict';

const { figure } = require('../../../_shared/figkit.js');

const total = 6.13;
const runs = [
  { depth: 0, name: 'LangGraph', hue: 'indigo', start: 0, secs: 6.13, meta: '6 child runs' },
  { depth: 1, name: 'model', hue: 'indigo', start: 0, secs: 3.33 },
  { depth: 2, name: 'ChatOllama', hue: 'plum', start: 0, secs: 3.33, meta: '282 tokens' },
  { depth: 1, name: 'tools', hue: 'indigo', start: 3.33, secs: 0 },
  { depth: 2, name: 'add', hue: 'green', start: 3.33, secs: 0 },
  { depth: 1, name: 'model', hue: 'indigo', start: 3.34, secs: 2.79 },
  { depth: 2, name: 'ChatOllama', hue: 'plum', start: 3.34, secs: 2.79, meta: '302 tokens' },
];
const messages = [
  { who: 'User', hue: 'violet', text: 'What is 305 + 18?' },
  { who: 'AI', hue: 'plum', text: 'tool call add(a=305, b=18)' },
  { who: 'add', hue: 'green', text: 'tool result 323' },
  { who: 'AI', hue: 'plum', text: '323' },
];

module.exports = figure('fig-7-6d', {
  height: 372,
  title: 'One traced agent run in the LangSmith trace view',
  desc: 'A redrawing of the LangSmith trace view for one create_agent run of Qwen3 4B on Ollama, in the project aiefs-lc101-trace on the hosted free plan. The left pane is the run tree: the LangGraph root of 6.13 s with 6 child runs, a model node of 3.33 s holding a ChatOllama call of 282 tokens, a tools node holding the add tool at 0.00 s, and a second model node of 2.79 s holding a ChatOllama call of 302 tokens. A bar beside each run shows when it ran inside the 6.13 s. The right pane is the root run: the input is the user question What is 305 + 18?, and the output is the user message, an AI message that calls add with a 305 and b 18, the tool result 323, and the final AI answer 323.',
}, f => {
  f.rect(16, 10, 608, 30, { hue: 'olive' });
  f.text(28, 30, 'LangSmith', { size: 12.5, weight: 700, hue: 'olive' });
  f.text(112, 30, 'project aiefs-lc101-trace, one run with tracing on', { size: 11.5, serif: true, hue: 'ink-soft' });

  f.kicker(28, 66, 'run tree');
  f.kicker(206, 66, 'waterfall');
  const barX = 206;
  const barW = 96;
  runs.forEach((run, index) => {
    const y = 92 + index * 38;
    const x = 28 + run.depth * 16;
    if (run.depth) f.rule(x - 8, y - 22, x - 8, y - 4, { hue: 'ink-mute' });
    f.rect(x, y - 11, 10, 10, { hue: run.hue });
    f.text(x + 16, y - 2, run.name, { size: 12, weight: 700, hue: run.hue });
    f.text(x + 16, y + 12, run.meta ? `${run.secs.toFixed(2)} s, ${run.meta}` : `${run.secs.toFixed(2)} s`, { size: 11, serif: true, hue: 'ink-soft' });
    const left = barX + (run.start / total) * barW;
    const width = Math.max(2, (run.secs / total) * barW);
    f.rect(left, y - 8, width, 8, { hue: run.hue });
  });

  f.rule(318, 54, 318, 360, { hue: 'ink-mute' });

  f.kicker(334, 66, 'root run, input');
  f.box({ x: 334, y: 76, w: 290, h: 40, hue: 'violet', title: 'User', sub: 'What is 305 + 18?', align: 'left', titleSize: 12, titleHue: 'violet' });
  f.kicker(334, 144, 'root run, output');
  messages.forEach((message, index) => {
    const y = 154 + index * 50;
    f.box({ x: 334, y, w: 290, h: 40, hue: message.hue, title: message.who, sub: message.text, align: 'left', titleSize: 12, titleHue: message.hue });
  });
});
