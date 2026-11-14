'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/recursion-mac.json'));
const cases = [
  ['stategraph_loop_recursion_limit_25', 'config 25', 'indigo'],
  ['stategraph_loop_env_25', 'env var 25', 'indigo'],
  ['stategraph_loop_no_config', 'default', 'indigo'],
  ['create_agent_forever_recursion_limit_25', 'config 25', 'blue'],
  ['create_agent_forever_no_config', 'default', 'blue'],
  ['create_agent_forever_with_checkpointer_no_config', 'with saver', 'blue'],
];

module.exports = figure('fig-5-8b', {
  height: 356,
  title: 'Steps before GraphRecursionError',
  desc: `A dot chart on a log scale of the steps each run made before GraphRecursionError on the Mac, one run each. A StateGraph loop stopped at 25 steps with recursion_limit 25 and with the environment variable set to 25, and at ${data.cases.stategraph_loop_no_config.limit_reached} with no config. A create_agent agent whose model always calls a tool stopped at 25 with recursion_limit 25 after ${data.cases.create_agent_forever_recursion_limit_25.model_calls} model calls, and at ${data.cases.create_agent_forever_no_config.limit_reached} with no config after ${data.cases.create_agent_forever_no_config.model_calls} model calls, with and without a checkpointer.`,
}, f => {
  const c = chart(f, { x: 70, y: 40, w: 540, h: 200, xDomain: [0, 7.5], yDomain: [10, 30000], yScale: 'log10', yTicks: [10, 100, 1000, 10000], yLabel: 'steps before the error, log scale' });
  cases.forEach(([key, label, hue], i) => {
    const row = data.cases[key];
    const slot = i < 3 ? i + 1 : i + 1.5;
    const x = c.px(slot);
    f.dot(x, c.py(row.limit_reached), { hue, r: 3.5 });
    f.text(x, c.py(row.limit_reached) - 10, String(row.limit_reached), { size: 11, anchor: 'middle', hue, knock: true });
    f.text(x, 258, label, { size: 11, anchor: 'middle', hue: 'ink-soft' });
    if (row.model_calls) f.text(x, 274, `${row.model_calls} calls`, { size: 11, anchor: 'middle', serif: true, hue: 'ink-soft' });
  });
  f.text((c.px(1) + c.px(3)) / 2, 296, 'StateGraph loop', { size: 11.5, anchor: 'middle', weight: 700, hue: 'indigo' });
  f.text((c.px(4.5) + c.px(6.5)) / 2, 296, 'create_agent', { size: 11.5, anchor: 'middle', weight: 700, hue: 'blue' });
  f.text(70, 326, 'Each dot is one run on the Mac. Calls under an agent case are its model calls.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(70, 344, `The agent default took ${data.cases.create_agent_forever_with_checkpointer_no_config.wall_s} s with a saver and ${data.cases.create_agent_forever_no_config.wall_s} s without one.`, { size: 11, serif: true, hue: 'ink-soft' });
});
