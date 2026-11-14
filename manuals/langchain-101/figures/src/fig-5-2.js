'use strict';

const fs = require('fs');
const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');

const text = fs.readFileSync(path.join(__dirname, '../../capture/out/34-stategraph-reducers-send-command.txt'), 'utf8');
const between = (a, b) => text.slice(text.indexOf(a) + a.length, text.indexOf(b));
const updates = between('## updates, one chunk per node run', '## final state').trim().split(/\n\n(?=\{)/).map(chunk => {
  const parsed = JSON.parse(chunk);
  const node = Object.keys(parsed)[0];
  return { node, write: parsed[node] };
});
const finalText = between('## final state: operator.add merged the parallel writes', '## two parallel writes');
const final = JSON.parse(finalText.slice(finalText.indexOf('{'), finalText.lastIndexOf('}') + 1));
const mermaid = between('## graph', '## updates');
const nodes = [...mermaid.matchAll(/^\t(\w+)\(/gm)].map(m => m[1]);
const ran = new Set(updates.map(u => u.node));
const skipped = nodes.filter(name => !ran.has(name) && !name.startsWith('__'));
let step = 0;
updates.forEach((u, i) => {
  if (!i || updates[i - 1].node !== u.node) step += 1;
  u.step = step;
});
const subjects = updates[0].write.subjects;
const pick = updates.find(u => u.node === 'pick');
const goto = /-> (\w+)/.exec(pick.write.log[0])[1];

const COL = { 1: 137, 2: 257, 3: 377, 4: 493 };
const KEYS = ['subjects', 'jokes', 'best', 'log'];

module.exports = figure('fig-5-2', {
  height: 480,
  title: 'The joke graph and one run',
  desc: `The top is the graph from the capture: __start__ to plan, then three Send arrows from plan to three write_joke tasks for ${subjects.join(', ')} in one step, then plain edges to pick. pick returns a Command with best set to "${pick.write.best}" and goto ${goto}, so ${goto} runs and then __end__. The ${skipped.join(' and ')} node, the other target of pick, did not run. The bottom is a table of what each node wrote to the state in each of the ${step} steps, read from the updates stream: plan wrote subjects, each write_joke wrote one joke, operator.add joined the three into a list of ${final.jokes.length}, and pick wrote best. The log key ends with ${final.log.length} entries.`,
}, f => {
  const start = f.box({ x: 12, y: 76, w: 74, h: 40, hue: 'grey', title: '__start__', titleSize: 11.5, pad: 4 });
  const plan = f.box({ x: 104, y: 76, w: 66, h: 40, hue: 'indigo', title: 'plan', sub: 'step 1', pad: 4 });
  f.arrow(start.right(), [plan.x - 1, plan.cy], { style: 'call' });
  subjects.forEach((subject, i) => {
    const task = f.box({ x: 206, y: 24 + i * 52, w: 102, h: 40, hue: 'indigo', title: 'write_joke', sub: subject, titleSize: 11.5, pad: 4 });
    f.path(`M170 96 H186 V${task.cy} H205`, { style: 'state' });
    f.path(`M308 ${task.cy} H324 V96 H343`, { style: 'call', head: i === 1 });
  });
  f.text(178, 16, `Send x ${subjects.length}`, { size: 11, hue: 'amber' });
  f.box({ x: 344, y: 76, w: 66, h: 40, hue: 'indigo', title: 'pick', sub: 'Command', pad: 4 });
  f.box({ x: 452, y: 36, w: 82, h: 40, hue: 'indigo', title: goto, sub: 'ran', pad: 4 });
  skipped.forEach(name => f.box({ x: 452, y: 124, w: 82, h: 40, hue: 'grey', title: name, sub: 'did not run', dash: 'dashed', pad: 4 }));
  f.path('M410 90 H428 V56 H451', { style: 'state' });
  f.path('M410 102 H428 V144 H451', { style: 'state', hue: 'grey' });
  f.text(431, 28, `goto ${goto}`, { size: 11, hue: 'amber' });
  f.box({ x: 560, y: 76, w: 68, h: 40, hue: 'grey', title: '__end__', titleSize: 11.5, pad: 4 });
  f.path('M534 56 H546 V90 H559', { style: 'call' });
  f.path('M534 144 H546 V102 H559', { style: 'call', hue: 'grey' });

  f.kicker(20, 186, 'what each step wrote to the state');
  Object.entries(COL).forEach(([n, x]) => {
    f.text(x, 210, `step ${n}`, { size: 11, anchor: 'middle', weight: 700, hue: 'amber' });
    f.rule(x - 60, 216, x - 60, 418, { hue: 'ink-mute', opacity: 0.3 });
  });
  let y = 236;
  for (const key of KEYS) {
    const cells = Object.keys(COL).map(n => updates.filter(u => u.step === Number(n) && key in u.write).flatMap(u => [].concat(u.write[key])));
    const lines = Math.max(1, ...cells.map(cell => (key === 'subjects' ? 1 : cell.length)));
    f.text(20, y + 4, key, { size: 11, weight: 700, hue: 'teal' });
    cells.forEach((cell, c) => {
      const x = COL[c + 1];
      const items = key === 'subjects' && cell.length ? [cell.join(', ')] : cell;
      items.forEach((item, k) => {
        f.rect(x - 59, y - 9 + k * 20, 118, 18, { fill: color('teal-fill'), stroke: color('teal-ink'), strokeWidth: 0.8 });
        f.text(x, y + 4 + k * 20, item, { size: 11, anchor: 'middle', max: 116 });
      });
    });
    if (key === 'jokes') {
      f.arrow([COL[2] + 60, y + 20], [COL[3] - 30, y + 20], { style: 'write' });
      f.text(COL[3] - 24, y + 16, `operator.add: ${final.jokes.length} items`, { size: 11, hue: 'teal', weight: 700, knock: true });
      f.text(COL[3] - 24, y + 30, 'one list in the state', { size: 11, serif: true, hue: 'ink-soft', knock: true });
    }
    y += lines * 20 + 14;
  }
  f.text(20, 450, `Three writes to jokes in one step joined into one list. The log key ends with ${final.log.length} entries.`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 468, 'Each teal cell is one value a node returned, read from the updates stream.', { size: 11, serif: true, hue: 'ink-soft' });
});
