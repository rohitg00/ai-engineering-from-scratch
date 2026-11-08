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

module.exports = figure('fig-1-3b', {
  height: 340,
  title: 'Answers get shorter as the model learns',
  desc: 'Mean answer length in tokens per step for three seeds. The cap is 1,024 tokens. Answers start near 720 tokens and end near 460, so fewer answers hit the cap.',
}, f => {
  const c = chart(f, { x: 60, y: 56, w: 560, h: 210, xDomain: [0, 47], yDomain: [350, 850], xTicks: [0, 12, 24, 36, 47], yTicks: [400, 500, 600, 700, 800], xLabel: 'step', yLabel: 'mean answer length, tokens' });
  for (const s of seeds) {
    const rows = runs[s.key].per_step;
    c.series(rows.map(r => [r.step, r.length]), { hue: s.hue, dash: s.dash, name: s.name, dots: false, width: 1.6 });
  }
  legend(f, seeds, 60, 22);
  const cut = seeds.map(s => { const rows = runs[s.key].per_step; const first = rows.slice(0, 8).reduce((a, r) => a + r.cut_share, 0) / 8; const last = rows.slice(-8).reduce((a, r) => a + r.cut_share, 0) / 8; return `${Math.round(first * 100)} to ${Math.round(last * 100)}`; });
  f.text(60, 326, `Percent of answers cut at the cap: ${cut.join('; ')}.`, { size: 12, serif: true });
});
