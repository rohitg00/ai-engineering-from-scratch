'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/prodapp-mac/summary/fix-mac.json')).load;
const count = (cell, key) => Object.entries(cell.kinds).filter(([k]) => k.startsWith(key)).reduce((s, [, v]) => s + v, 0);
const parts = cell => [
  ['done', count(cell, 'runs:200:done') + count(cell, 'approve:200:done'), 'violet'],
  ['interrupted', count(cell, 'runs:200:interrupted'), 'amber'],
  ['409 on approve', count(cell, 'approve:409'), 'grey'],
  ['ReadTimeout', Object.values(cell.client_errors).reduce((s, v) => s + v, 0), 'rose'],
];
const ROWS = [['without a heartbeat', data.before], ['with a heartbeat every 15 s', data.after]];
const total = Math.max(...ROWS.map(([, c]) => parts(c).reduce((s, p) => s + p[1], 0)));
const scale = 600 / total;

module.exports = figure('fig-9-1c', {
  height: 236,
  title: 'What 50 clients saw, without and with a heartbeat on the stream',
  desc: ROWS.map(([label, c]) => `${label}: ${parts(c).map(([n, v]) => `${v} ${n}`).join(', ')}, ${c.runs_per_s_exact} runs each second`).join('. ') + '. One worker, Qwen3 4B on the Mac, read timeout 120 s.',
}, f => {
  ROWS.forEach(([label, cell], r) => {
    const y = 20 + r * 86;
    f.text(16, y + 12, label, { size: 11.5, weight: 700 });
    f.text(16, y + 28, `${cell.runs_per_s_exact} runs each second, median ${cell.p50_s.toFixed(0)} s per run`, { size: 11, serif: true, hue: 'ink-soft' });
    let x = 16;
    for (const [name, value, hue] of parts(cell)) {
      if (!value) continue;
      const w = value * scale;
      f.rect(x, y + 38, w, 26, { hue });
      if (w > 30) f.text(x + w / 2, y + 55, String(value), { size: 11, anchor: 'middle' });
      x += w;
    }
  });
  const legend = parts(data.before);
  legend.forEach(([name, , hue], i) => {
    f.rect(16 + i * 140, 206, 12, 12, { hue });
    f.text(34 + i * 140, 216, name, { size: 11, hue: 'ink-soft' });
  });
});
