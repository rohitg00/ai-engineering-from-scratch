'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/approvals-mac.json'));
const groups = [
  ['batched', ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'J1', 'J2', 'J3']],
  ['per call', ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'J4', 'J5']],
];
const allowed = { B1: 1, B2: 1, B3: 1, B4: 0, B5: 0, B6: 2, B7: 1, B8: 2, B9: 0, J1: 1, J2: 0, J3: 0, P1: 1, P2: 1, P3: 0, P4: 0, P5: 0, P6: 1, P7: 2, P8: 0, J4: 0, J5: 0 };
const bypassed = ['J1', 'J2', 'J3'];
const cell = code => {
  const key = Object.keys(data.cases).find(name => name.startsWith(`${code}_`));
  return data.cases[key].tools_run.map(run => run.length);
};

module.exports = figure('fig-5-5b', {
  height: 330,
  title: 'Tool runs in each approval case',
  desc: `A dot chart of tool runs for 22 approval cases on the Mac, 3 runs each, with a short line at the number of tool runs the decisions allowed. Batched cases B1 to B9 and per-call cases P1 to P8, J4, and J5 sit on their lines in all runs. The batched cases J1, J2, and J3, with a middleware that jumps to tools, each ran ${cell('J2')[0]} tool in every run without an approval, and are drawn in rose.`,
}, f => {
  const slots = groups.reduce((total, [, codes]) => total + codes.length, 0) + 1;
  const c = chart(f, { x: 60, y: 40, w: 560, h: 180, xDomain: [0, slots + 1], yDomain: [0, 2.5], yTicks: [0, 1, 2], yLabel: 'tools run in one case' });
  let slot = 1;
  groups.forEach(([name, codes], g) => {
    const first = slot;
    codes.forEach(code => {
      const x = c.px(slot);
      f.rule(x - 11, c.py(allowed[code]), x + 11, c.py(allowed[code]), { hue: 'ink-mute', width: 2 });
      cell(code).forEach((v, j) => f.dot(x + (j - 1) * 6, c.py(v), { hue: bypassed.includes(code) ? 'rose' : 'blue', r: 2.6 }));
      f.text(x, 238, code, { size: 11, anchor: 'middle', hue: bypassed.includes(code) ? 'rose' : 'ink-soft' });
      slot += 1;
    });
    f.text((c.px(first) + c.px(slot - 1)) / 2, 260, name, { size: 11.5, anchor: 'middle', weight: 700 });
    if (g === 0) slot += 1;
  });
  f.dot(64, 292, { hue: 'blue', r: 3 });
  f.text(74, 296, 'tools matched the decisions', { size: 11, hue: 'blue' });
  f.dot(290, 292, { hue: 'rose', r: 3 });
  f.text(300, 296, 'a tool ran with no approval', { size: 11, hue: 'rose' });
  f.text(60, 322, 'Each dot is one run on the Mac. The grey line is the count the decisions allowed.', { size: 11, serif: true, hue: 'ink-soft' });
});
