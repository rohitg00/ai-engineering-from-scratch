'use strict';

const { figure } = require('../../../_shared/figkit.js');
const { chart, legend } = require('../../../_shared/chart.js');

const NODE = 121.69;
const LIMIT = 0.95 * NODE;
const items = [
  { name: '0.6B', value: 0.6 * 16, hue: 'blue', label: 'about 10 GB' },
  { name: '1.7B', value: 1.7 * 16, hue: 'blue', label: 'about 27 GB' },
  { name: '4B', value: 4 * 16, hue: 'blue', label: 'about 64 GB' },
  { name: '4B, run 1', value: 115.86, hue: 'rose', label: ' ' },
  { name: '4B, run 2', value: 119.18, hue: 'rose', label: ' ' },
];

module.exports = figure('fig-2-1', {
  height: 340,
  title: '1.7B fits for short steps, and 4B does not',
  desc: 'Blue bars: the trainer state of full fine-tuning with Adam, estimated at 16 bytes per parameter, before activations and the engine. Rose bars: the node memory that Ray read when it stopped the two 4B runs, 115.86 GB with the engine memory fraction at 0.4 and 119.18 GB at 0.2, out of 121.69 GB. Ray stops a worker above 95 percent of the node, about 115.6 GB.',
}, f => {
  const c = chart(f, { x: 60, y: 56, w: 560, h: 210, xDomain: [0, 1], yDomain: [0, 130], yTicks: [0, 30, 60, 90, 120], yLabel: 'GB' });
  f.rule(60, c.py(NODE), 620, c.py(NODE), { hue: 'ink' });
  f.text(64, c.py(NODE) - 5, 'node, 121.7 GB', { size: 11, hue: 'ink-soft' });
  f.line(60, c.py(LIMIT), 620, c.py(LIMIT), { style: 'fail', head: false, packet: false });
  f.text(64, c.py(LIMIT) + 14, 'Ray stops a worker above 95 percent', { size: 11, hue: 'rose', knock: true });
  c.bars(items, { width: 60 });
  c.note(0.7, 70, '115.9 GB', { anchor: 'middle', hue: 'rose', serif: false });
  c.note(0.9, 70, '119.2 GB', { anchor: 'middle', hue: 'rose', serif: false });
  legend(f, [{ name: 'trainer state, estimate', hue: 'blue' }, { name: 'node memory at the Ray kill', hue: 'rose' }], 60, 22);
  f.text(60, 324, 'Lowering the engine memory did not save 4B. All runs used 256-token answers.', { size: 12, serif: true });
});
