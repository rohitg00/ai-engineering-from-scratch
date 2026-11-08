'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, legend, load } = require('../../../_shared/chart.js');

const runs = load(path.join(__dirname, '../../capture/gpu/summary/miles-gb10-lab.json')).runs;
const seeds = [
  { key: 'plain-48', name: 'seed 1234', hue: 'green', dash: 'solid' },
  { key: 'plain-48-s2', name: 'seed 2', hue: 'teal', dash: 'dashed' },
  { key: 'plain-48-s3', name: 'seed 3', hue: 'olive', dash: 'dotted' },
];
const mean = (rows, a, b) => rows.slice(a, b).reduce((sum, r) => sum + r.reward, 0) / (b - a);

module.exports = figure('fig-1-3', {
  height: 340,
  title: 'Reward over 48 steps, three seeds',
  desc: 'Mean reward per step for three seeds of the same GRPO run on Qwen3-0.6B and GSM8K. Each step jumps around, and the trend goes up for all three seeds.',
}, f => {
  const c = chart(f, { x: 60, y: 56, w: 560, h: 210, xDomain: [0, 47], yDomain: [0.5, 0.9], xTicks: [0, 12, 24, 36, 47], yTicks: [0.5, 0.6, 0.7, 0.8, 0.9], xLabel: 'step', yLabel: 'mean reward of the step' });
  for (const s of seeds) {
    const rows = runs[s.key].per_step;
    c.series(rows.map(r => [r.step, r.reward]), { hue: s.hue, dash: s.dash, name: s.name, dots: false, width: 1.6 });
  }
  legend(f, seeds, 60, 22);
  const gains = seeds.map(s => { const rows = runs[s.key].per_step; return (mean(rows, rows.length - 8, rows.length) - mean(rows, 0, 8)).toFixed(3); });
  f.text(60, 326, `Gain, last 8 steps against the first 8: +${gains.join(', +')}.`, { size: 12, serif: true });
});
