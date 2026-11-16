'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const S = load(path.join(__dirname, '../../capture/lab/bench/summary-mac.json'));
const SP = S.sampling;
const subset = S.main.subset;
const mixed = new Set(SP.mixed);
const seeds = Object.keys(SP.seeds).sort();
const ROWS = [
  ...SP.greedy.plain.map((r, i) => ({ label: `greedy, run ${i + 1}`, tasks: r, hue: 'violet', group: 'plain loop, temperature 0, seed 42' })),
  ...SP.greedy.deep_agent.map((r, i) => ({ label: `greedy, run ${i + 1}`, tasks: r, hue: 'blue', group: 'deep agent, temperature 0, seed 42' })),
  ...seeds.map(k => ({ label: `seed ${k.split('-s')[1]}`, tasks: SP.seeds[k].tasks, hue: 'violet', group: 'plain loop, temperature 0.7' })),
];
const X0 = 160;
const SQ = 12;
const RH = 18;
const Y0 = 62;
const FAMS = ['chain', 'sql', 'r', 'files', 'multi'];
const famName = { chain: 'chain', sql: 'sql', r: 'retrieval', files: 'files', multi: 'multiturn' };
const colX = t => X0 + subset.indexOf(t) * (SQ + 1) + FAMS.findIndex(p => t.startsWith(p)) * 6;
const count = r => subset.filter(t => r.tasks[t]).length;

module.exports = figure('fig-r-11', {
  height: Y0 + 9 * RH + 3 * 22 + 50,
  title: 'Three greedy runs repeat each other, three sampled runs do not',
  desc: `A grid of the 30 subset tasks for Qwen3 4B on the Mac. The plain loop and the deep agent each ran three times at temperature 0 and seed 42, and every run gave the same outcome on every task, with the same tokens and tool calls: ${count(ROWS[0])} and ${count(ROWS[3])} of 30. The plain loop at temperature 0.7 with seeds 1, 2 and 3 passed ${seeds.map(k => SP.seeds[k].pass).join(', ')} of 30, and ${SP.mixed.length} tasks changed outcome between seeds: ${SP.mixed.join(', ')}.`,
}, f => {
  f.kicker(20, 22, 'Qwen3 4B, 30 subset tasks');
  f.kicker(620, 22, 'pass', { anchor: 'end' });
  FAMS.forEach(p => {
    const ts = subset.filter(t => t.startsWith(p));
    const a = colX(ts[0]);
    const b = colX(ts[ts.length - 1]) + SQ - 1;
    f.text((a + b) / 2, 44, famName[p], { size: 11, anchor: 'middle', hue: 'ink-soft' });
    f.rule(a, 50, b, 50, { hue: 'ink-mute' });
  });
  let y = Y0;
  let group = null;
  ROWS.forEach((r, i) => {
    if (r.group !== group) {
      group = r.group;
      y += 6;
      f.beat(Math.floor(i / 3) + 1);
      f.text(20, y + 8, group, { size: 11, weight: 700, hue: r.hue });
      y += 16;
    }
    f.text(28, y + 10, r.label, { size: 11, hue: 'ink-soft' });
    subset.forEach(t => f.rect(colX(t), y, SQ - 2, RH - 5, { fill: color(r.tasks[t] ? `${r.hue}-ink` : 'rose-ink'), stroke: 'none' }));
    f.text(620, y + 10, `${count(r)}/30`, { size: 11, hue: 'ink', anchor: 'end', weight: 700 });
    y += RH;
  });
  f.beat(0);
  subset.filter(t => mixed.has(t)).forEach(t => {
    f.path(`M${colX(t) + (SQ - 2) / 2} ${y + 10} L${colX(t) + (SQ - 2) / 2 - 4} ${y + 17} L${colX(t) + (SQ - 2) / 2 + 4} ${y + 17} Z`, { hue: 'amber', head: false, width: 1.4, packet: false });
  });
  f.text(20, y + 34, `amber marks: the ${mixed.size} tasks whose outcome changed between seeds`, { size: 11, serif: true, hue: 'amber' });
});
