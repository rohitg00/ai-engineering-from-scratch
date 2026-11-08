'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/gpu/summary/miles-gb10-lab.json')).runs;
const steady = name => {
  const later = runs[name].per_step.filter(p => p.step >= 2);
  const mean = key => later.reduce((a, p) => a + p[key], 0) / later.length;
  return { update_weights_time_s: mean('update_weights_time_s'), sleep_time_s: mean('sleep_time_s'), wake_up_time_s: mean('wake_up_time_s') };
};
const small = steady('e4-0.6b');
const large = steady('e4-1.7b');
const times = key => (large[key] / small[key]).toFixed(1);
const items = [];
for (const [key, name] of [['update_weights_time_s', 'update'], ['sleep_time_s', 'offload'], ['wake_up_time_s', 'onload']]) {
  items.push({ name: `${name} 0.6B`, value: small[key], hue: 'blue', label: `${small[key].toFixed(2)} s` });
  items.push({ name: `${name} 1.7B`, value: large[key], hue: 'violet', label: `${large[key].toFixed(2)} s` });
}

module.exports = figure('fig-2-4', {
  height: 330,
  title: 'A larger model costs more to offload than to update',
  desc: `Mean seconds of steps 2 and 3 of 4 short steps, after two warm-up steps. Weight update: ${small.update_weights_time_s.toFixed(2)} s for Qwen3-0.6B and ${large.update_weights_time_s.toFixed(2)} s for Qwen3-1.7B. Trainer offload: ${small.sleep_time_s.toFixed(2)} and ${large.sleep_time_s.toFixed(2)} s. Trainer onload: ${small.wake_up_time_s.toFixed(2)} and ${large.wake_up_time_s.toFixed(2)} s.`,
}, f => {
  const c = chart(f, { x: 60, y: 56, w: 560, h: 200, xDomain: [0, 1], yDomain: [0, 4], yTicks: [0, 2, 4], yLabel: 'seconds, mean of steps 2 and 3' });
  c.bars(items, { width: 52 });
  legend(f, [{ name: 'Qwen3-0.6B', hue: 'blue' }, { name: 'Qwen3-1.7B, 2.8 times the size', hue: 'violet' }], 60, 22);
  f.text(60, 314, `The update grew ${times('update_weights_time_s')} times. Trainer offload and onload grew ${times('sleep_time_s')} and ${times('wake_up_time_s')} times.`, { size: 12, serif: true });
});
