'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/retries-x86.json'));
const faults = [['m_drop_always', 'dropped every call'], ['m_refused_always', 'refused every call'], ['m_timeout_always', 'timeout every call']];
const configs = [['openai_client_default', 'client default', 'plum'], ['openai_mw_only', 'middleware only', 'blue'], ['openai_stacked', 'both layers', 'rose']];
const cell = (fault, config) => data.cells[`${fault} ${config}`].model_attempts;

module.exports = figure('fig-3-2b', {
  height: 360,
  title: 'Model attempts at the relay for one failing model call',
  desc: `A dot chart of model attempts at a relay in front of Ollama with Qwen3 4B on the x86 server guest, 3 runs for each cell. Three groups for a dropped connection, a refused port, and a timeout on every call. In each group the client default of ChatOpenAI made ${cell('m_drop_always', 'openai_client_default')[0]} attempts, ModelRetryMiddleware with client retries off made ${cell('m_drop_always', 'openai_mw_only')[0]}, and both layers together made ${cell('m_drop_always', 'openai_stacked')[0]}. All three runs of every cell gave the same count.`,
}, f => {
  const c = chart(f, { x: 70, y: 40, w: 540, h: 230, xDomain: [0, 12], yDomain: [0, 10], yTicks: [0, 1, 3, 7, 9], yLabel: 'model attempts at the relay' });
  f.rule(c.px(0), c.py(7), c.px(12), c.py(7), { hue: 'ink-mute', dash: 'dashed' });
  f.text(c.px(12) - 4, c.py(7) - 6, 'the documented 6 retries, 7 attempts', { size: 11, serif: true, anchor: 'end', hue: 'ink-mute', knock: true });
  faults.forEach(([fault, label], g) => {
    configs.forEach(([config, , hue], i) => {
      const slot = 1 + g * 4 + i;
      cell(fault, config).forEach((v, j) => f.dot(c.px(slot) + (j - 1) * 7, c.py(v), { hue, r: 3 }));
    });
    f.text(c.px(2 + g * 4), 290, label, { size: 11, anchor: 'middle', hue: 'ink-soft' });
  });
  configs.forEach(([, label, hue], i) => {
    const x = 70 + i * 180;
    f.dot(x + 4, 322, { hue, r: 3.5 });
    f.text(x + 14, 326, label, { size: 11.5, hue });
  });
  f.text(70, 350, 'Each dot is one run on the x86 server guest. The real 404 made 1 attempt in each.', { size: 11, serif: true, hue: 'ink-soft' });
});
