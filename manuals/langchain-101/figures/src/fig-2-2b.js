'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/retries-mac.json'));
const faults = [['m429_always', '429 every call'], ['m500_always', '500 every call'], ['mtimeout_always', 'timeout every call']];
const configs = [['client_default', 'client default', 'plum'], ['model_retry_mw_only', 'middleware only', 'blue'], ['stacked_client_plus_model_mw', 'both layers', 'rose']];
const cell = (fault, config) => data.cells[`${fault} ${config}`].model_attempts;

module.exports = figure('fig-2-2b', {
  height: 360,
  title: 'Model attempts at the stub for one failing model call',
  desc: `A dot chart of model attempts at a local stub on the Mac, 3 runs for each cell. Three groups for a 429, a 500, and a timeout on every call. In each group the client default of ChatOpenAI made ${cell('m429_always', 'client_default')[0]} attempts, ModelRetryMiddleware with client retries off made ${cell('m429_always', 'model_retry_mw_only')[0]}, and both layers together made ${cell('m429_always', 'stacked_client_plus_model_mw')[0]}. All three runs of every cell gave the same count.`,
}, f => {
  const c = chart(f, { x: 70, y: 40, w: 540, h: 230, xDomain: [0, 12], yDomain: [0, 10], yTicks: [0, 1, 3, 6, 9], yLabel: 'model attempts at the stub' });
  f.rule(c.px(0), c.py(6), c.px(12), c.py(6), { hue: 'ink-mute', dash: 'dashed' });
  f.text(c.px(12) - 4, c.py(6) - 6, 'the documented 6 retries', { size: 11, serif: true, anchor: 'end', hue: 'ink-mute', knock: true });
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
  f.text(70, 350, 'Each dot is one run on the Mac. A 400 made 1 attempt in every configuration.', { size: 11, serif: true, hue: 'ink-soft' });
});
