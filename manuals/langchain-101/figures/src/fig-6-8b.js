'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const graph = load(path.join(__dirname, '../../capture/lab/summary/recursion-mac.json'));
const agent = load(path.join(__dirname, '../../capture/lab/summary/recursion-x86.json'));
const same = values => {
  if (!values.every(v => v === values[0])) throw new Error('fig-6-8b: runs differ');
  return values[0];
};
const capped = agent.cases.create_agent_forever_no_config_capped;
const points = [
  { steps: graph.cases.stategraph_loop_recursion_limit_25.limit_reached, label: 'config 25', hue: 'indigo' },
  { steps: graph.cases.stategraph_loop_env_25.limit_reached, label: 'env var 25', hue: 'indigo' },
  { steps: graph.cases.stategraph_loop_no_config.limit_reached, label: 'default', hue: 'indigo' },
  { steps: agent.cases.create_agent_forever_recursion_limit_25.limit_reached, label: 'config 25', hue: 'blue', calls: same(agent.cases.create_agent_forever_recursion_limit_25.model_calls) },
  { steps: agent.cases.create_agent_forever_recursion_limit_101.limit_reached, label: 'config 101', hue: 'blue', calls: same(agent.cases.create_agent_forever_recursion_limit_101.model_calls) },
  { steps: capped.steps, label: 'default', hue: 'rose', calls: capped.model_calls },
];

module.exports = figure('fig-6-8b', {
  height: 356,
  title: 'Steps before GraphRecursionError',
  desc: `A dot chart on a log scale of the steps each run made before it stopped. A StateGraph loop on the Mac, with no model, stopped at 25 steps with recursion_limit 25 and with the environment variable set to 25, and at ${graph.cases.stategraph_loop_no_config.limit_reached} with no config. A create_agent agent with Qwen3 4B on the x86 server guest stopped at 25 steps after ${points[3].calls} model calls and at 101 after ${points[4].calls}, in 3 of 3 runs each. With the default limit, the lab script stopped it at ${capped.steps} steps after ${capped.model_calls} model calls in ${Math.round(capped.wall_s / 60)} minutes.`,
}, f => {
  const c = chart(f, { x: 70, y: 40, w: 540, h: 200, xDomain: [0, 7.5], yDomain: [10, 30000], yScale: 'log10', yTicks: [10, 100, 1000, 10000], yLabel: 'steps before the stop, log scale' });
  points.forEach((p, i) => {
    const slot = i < 3 ? i + 1 : i + 1.5;
    const x = c.px(slot);
    f.dot(x, c.py(p.steps), { hue: p.hue, r: 3.5 });
    f.text(x, c.py(p.steps) - 10, String(p.steps), { size: 11, anchor: 'middle', hue: p.hue, knock: true });
    f.text(x, 258, p.label, { size: 11, anchor: 'middle', hue: 'ink-soft' });
    if (p.calls) f.text(x, 274, `${p.calls} calls`, { size: 11, anchor: 'middle', serif: true, hue: 'ink-soft' });
  });
  f.text((c.px(1) + c.px(3)) / 2, 296, 'StateGraph loop, the Mac', { size: 11.5, anchor: 'middle', weight: 700, hue: 'indigo' });
  f.text((c.px(4.5) + c.px(6.5)) / 2, 296, 'create_agent, Qwen3 4B', { size: 11.5, anchor: 'middle', weight: 700, hue: 'blue' });
  f.text(70, 326, 'Calls under an agent case are its model calls. The agent ran on the x86 server guest.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(70, 344, `The rose default run did not reach the limit: the lab script stopped it after ${Math.round(capped.wall_s)} s.`, { size: 11, serif: true, hue: 'rose' });
});
