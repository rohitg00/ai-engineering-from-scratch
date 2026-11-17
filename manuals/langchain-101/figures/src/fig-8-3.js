'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/overhead-mac-real.json'));
const v = data.variants;
const programs = [
  ['a_plain_openai', ['plain', 'openai loop'], 'grey'],
  ['b_bind_tools_loop', ['ChatOpenAI', 'bind_tools loop'], 'blue'],
  ['c_create_agent', ['create_agent'], 'blue'],
  ['d_create_agent_saver', ['create_agent', 'InMemorySaver'], 'teal'],
  ['e_stategraph', ['hand-built', 'StateGraph'], 'blue'],
];

module.exports = figure('fig-8-3', {
  height: 380,
  title: 'Time beyond the model in one run of three Qwen3 4B calls',
  desc: `A dot chart of the milliseconds outside the model in each run on the Mac, ${v.a_plain_openai.n} runs per program, against Qwen3 4B on Ollama through a proxy that timed each model call. Medians: plain openai loop ${v.a_plain_openai.framework_ms_median} ms, ChatOpenAI bind_tools loop ${v.b_bind_tools_loop.framework_ms_median} ms, create_agent ${v.c_create_agent.framework_ms_median} ms, create_agent with InMemorySaver ${v.d_create_agent_saver.framework_ms_median} ms, hand-built StateGraph ${v.e_stategraph.framework_ms_median} ms.`,
}, f => {
  const c = chart(f, { x: 70, y: 40, w: 540, h: 250, xDomain: [0, 5], yDomain: [0, 80], yTicks: [0, 20, 40, 60, 80], yLabel: 'milliseconds outside the model' });
  programs.forEach(([key, label, hue], i) => {
    const cx = c.px(i + 0.5);
    const d = v[key].framework_ms.map((ms, j) => `M${Math.round(cx + ((j * 37) % 61 - 30) * 1.3) - 2} ${Math.round(c.py(ms))}a2 2 0 1 0 4 0a2 2 0 1 0-4 0`).join('');
    f.mark(d, { hue });
    const med = v[key].framework_ms_median;
    f.rule(cx - 44, c.py(med), cx + 44, c.py(med), { hue: 'ink', width: 2 });
    f.text(cx, c.py(med) - 8, `${med} ms`, { size: 11, hue: 'ink', anchor: 'middle', knock: true, weight: 700 });
    label.forEach((line, k) => f.text(cx, 308 + k * 14, line, { size: 11, anchor: 'middle', hue: 'ink-soft' }));
  });
  f.text(70, 356, `Each dot is one run of three model calls and two tool calls, ${v.a_plain_openai.n} per program.`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(70, 372, 'The black line is the median. Warm-up rounds are left out.', { size: 11, serif: true, hue: 'ink-soft' });
});
