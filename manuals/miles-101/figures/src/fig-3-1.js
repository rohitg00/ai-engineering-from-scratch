'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/gpu/summary/miles-gb10-lab.json')).runs;
const gain = key => { const r = runs[key].per_step.slice(0, 24); const m = rows => rows.reduce((a, x) => a + x.reward, 0) / rows.length; return m(r.slice(16, 24)) - m(r.slice(0, 8)); };
const items = [
  { name: '4, one seed', key: 'e2-n4', hue: 'olive' },
  { name: '8, seed 1234', key: 'plain-48', hue: 'green' },
  { name: '8, seed 2', key: 'plain-48-s2', hue: 'green' },
  { name: '8, seed 3', key: 'plain-48-s3', hue: 'green' },
  { name: '16, one seed', key: 'e2-n16', hue: 'teal' },
].map(i => ({ ...i, value: gain(i.key), label: `+${gain(i.key).toFixed(3)}` }));

module.exports = figure('fig-3-1', {
  height: 330,
  title: 'More answers per prompt, same learning in 24 steps',
  desc: `Reward gain over the first 24 steps, the mean of steps 16 to 23 minus the mean of steps 0 to 7, for 4, 8, and 16 answers per prompt. 4 answers: +${gain('e2-n4').toFixed(3)}. 8 answers, three seeds: +${gain('plain-48').toFixed(3)}, +${gain('plain-48-s2').toFixed(3)}, +${gain('plain-48-s3').toFixed(3)}. 16 answers: +${gain('e2-n16').toFixed(3)}.`,
}, f => {
  const c = chart(f, { x: 60, y: 40, w: 560, h: 210, xDomain: [0, 1], yDomain: [0, 0.12], yTicks: [0, 0.12], yFormat: v => v.toFixed(2), yLabel: 'reward gain over 24 steps' });
  c.bars(items, { width: 60 });
  f.text(340, 284, 'answers per prompt', { size: 11.5, anchor: 'middle', serif: true, hue: 'ink-soft' });
  f.text(60, 316, '16 answers stayed inside the range of the three seeds at 8.', { size: 12, serif: true });
});
