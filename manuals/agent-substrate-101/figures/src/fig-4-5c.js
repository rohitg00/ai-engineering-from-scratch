'use strict';

const fs = require('fs');
const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart } = require('../../../_shared/chart.js');

const lab = path.join(__dirname, '../../capture/lab/K-kagent/parallel');
const rows = fs.readFileSync(path.join(lab, 'timings.tsv'), 'utf8').trim().split('\n').map(line => line.split('\t'));
const turns = prefix => rows.filter(cells => cells[1].startsWith(`${prefix}-`)).map(cells => Number(cells[3])).sort((a, b) => a - b);
const p8 = turns('P8');
const p24 = turns('P24');
const cpus = Number(/N=24 actors=\d+\/\d+ cpu=\d+\/(\d+)/.exec(fs.readFileSync(path.join(lab, 'workers-during.txt'), 'utf8'))[1]) / 1000;
const head = p24.slice(0, cpus);
const tail = p24.slice(cpus);
const one = value => value.toFixed(1);

module.exports = figure('fig-4-5c', {
  height: 318,
  title: 'Time of each turn with 8 and with 24 turns at the same time on one worker',
  desc: `A chart of seconds for each turn against the order in which the turns completed. With ${p8.length} turns at the same time, every turn took ${one(p8[0])} to ${one(p8[p8.length - 1])} seconds. With ${p24.length} turns at the same time on a worker that reports ${cpus} CPUs, the first ${head.length} turns took ${one(head[0])} to ${one(head[head.length - 1])} seconds and the last ${tail.length} took ${one(tail[0])} to ${one(tail[tail.length - 1])} seconds.`,
}, f => {
  const c = chart(f, {
    x: 64, y: 40, w: 536, h: 216,
    xDomain: [0, 25], yDomain: [0, 9],
    xTicks: [1, 4, 8, 12, 16, 20, 24], yTicks: [0, 3, 6, 9],
    xLabel: 'turns in the order of completion', yLabel: 'seconds for the turn, kagent guest, one run of each',
  });
  f.rule(c.px(cpus + 0.5), 40, c.px(cpus + 0.5), 256, { hue: 'violet', dash: 'dashed', width: 1.3 });
  f.text(c.px(cpus + 0.5) - 6, 52, `the worker reports ${cpus} CPUs`, { size: 11, hue: 'violet', anchor: 'end' });
  c.series(p8.map((s, i) => [i + 1, s]), { hue: 'green', width: 1.2, r: 3.2, dash: 'dotted' });
  c.series(head.map((s, i) => [i + 1, s]), { hue: 'green', width: 1.2, r: 3.2 });
  c.series(tail.map((s, i) => [cpus + i + 1, s]), { hue: 'amber', width: 1.2, r: 3.2 });
  c.note(4.5, 2, `${p8.length} turns at once: ${one(p8[0])} to ${one(p8[p8.length - 1])} s`, { hue: 'green', serif: false });
  c.note(16.2, 4.1, `${p24.length} turns at once, first ${head.length}: ${one(head[0])} to ${one(head[head.length - 1])} s`, { hue: 'green', serif: false, anchor: 'end' });
  c.note(24.8, 5.3, `last ${tail.length}, after a wait:`, { hue: 'amber', serif: false, anchor: 'end' });
  c.note(24.8, 4.7, `${one(tail[0])} to ${one(tail[tail.length - 1])} s`, { hue: 'amber', serif: false, anchor: 'end' });
});
