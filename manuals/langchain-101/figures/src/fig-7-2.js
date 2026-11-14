'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/overhead-mac.json'));
const programs = [
  ['a_plain_openai', ['plain', 'openai loop'], 'grey'],
  ['b_bind_tools_loop', ['ChatOpenAI', 'bind_tools loop'], 'blue'],
  ['c_create_agent', ['create_agent'], 'blue'],
  ['d_create_agent_saver', ['create_agent', 'InMemorySaver'], 'teal'],
];

module.exports = figure('fig-7-2', {
  height: 380,
  title: 'Wall time of one run of three model calls against a stub',
  desc: `A dot chart of milliseconds per run on the Mac, ${data.stub.a_plain_openai.n} runs per program, against a local stub that answers each model call at once. Medians: plain openai loop ${data.stub.a_plain_openai.median_ms} ms, ChatOpenAI bind_tools loop ${data.stub.b_bind_tools_loop.median_ms} ms, create_agent ${data.stub.c_create_agent.median_ms} ms, create_agent with InMemorySaver ${data.stub.d_create_agent_saver.median_ms} ms.`,
}, f => {
  const c = chart(f, { x: 70, y: 40, w: 540, h: 250, xDomain: [0, 4], yDomain: [0, 18], yTicks: [0, 3, 6, 9, 12, 15, 18], yLabel: 'milliseconds per run' });
  programs.forEach(([key, label, hue], i) => {
    const cx = c.px(i + 0.5);
    const d = data.stub[key].wall_ms.map((v, j) => `M${Math.round(cx + ((j * 37) % 61 - 30) * 1.7) - 2} ${Math.round(c.py(v))}a2 2 0 1 0 4 0a2 2 0 1 0-4 0`).join('');
    f.mark(d, { hue });
    const med = data.stub[key].median_ms;
    f.rule(cx - 56, c.py(med), cx + 56, c.py(med), { hue: 'ink', width: 2 });
    f.text(cx, c.py(med) - 8, `${med} ms`, { size: 11, hue: 'ink', anchor: 'middle', knock: true, weight: 700 });
    label.forEach((line, k) => f.text(cx, 308 + k * 14, line, { size: 11, anchor: 'middle', hue: 'ink-soft' }));
  });
  f.text(70, 356, `Each dot is one run of three model calls and two tool calls, ${data.stub.a_plain_openai.n} per program.`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(70, 372, 'The black line is the median. Warm-up runs are left out.', { size: 11, serif: true, hue: 'ink-soft' });
});
