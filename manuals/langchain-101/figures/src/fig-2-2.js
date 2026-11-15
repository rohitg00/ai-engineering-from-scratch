'use strict';

const fs = require('fs');
const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const forms = require('../../../_shared/forms.js');

const read = name => fs.readFileSync(path.join(__dirname, '../../capture/lab/internals', name), 'utf8');
const trace = read('02-channels/trace.txt');
const partB = trace.slice(trace.indexOf('# B.'), trace.indexOf('# C.'));
const ran = JSON.parse(/node bodies that ran before the raise: (\[.*\])/.exec(partB)[1].replace(/'/g, '"'));
const putLine = /loop.put_writes calls before the raise[^:]*: (\[.*\])$/m.exec(partB)[1];
const pending = [...putLine.matchAll(/\('([ab])', \[\('(\w+)', (\d+)\)\]\)/g)].map(m => ({ node: m[1], channel: m[2], value: Number(m[3]) }));
if (pending.length !== 2) throw new Error('fig-2-2: expected two node writes');
const errorName = /^raised (\w+):/m.exec(partB)[1];
const getStateFrames = /get_state after the raise ALSO raises \w+ via (\[.*\])/.exec(partB)[1];
const resumeRan = /node bodies re-run on resume: (\[[^\]]*\])/.exec(partB)[1];
const ckptStep = /raw saver.get_tuple works: checkpoint step=(\d+)/.exec(partB)[1];

const repair = read('02-channels/repair.txt');
const fixed = repair.slice(repair.indexOf('## 2.'), repair.indexOf('## 3.'));
const fixedState = /get_state: ok -> (\{[^}]*\})/.exec(fixed)[1];
const fixedRan = /node bodies run by invoke\(None\): (\[[^\]]*\])/.exec(fixed)[1];
const fixedSchema = /graph recompiled with (.*)$/m.exec(fixed)[1];
if (resumeRan !== '[]' || fixedRan !== '[]') throw new Error('fig-2-2: expected no node to run again');

const CODE = 64;
const LOOP = 230;
const NODES = 392;
const SAVER = 560;

module.exports = figure('fig-2-2', {
  height: 600,
  title: 'A LastValue conflict, the reads that fail after it, and the repair',
  desc: `A sequence on four lifelines: your code, the Pregel loop, the nodes a and b, and InMemorySaver. invoke starts the run. The loop runs ${ran.join(' and ')}, and each finished node has its write to x saved as a pending write on checkpoint step ${ckptStep}: ${pending.map(p => `${p.channel}=${p.value} from ${p.node}`).join(' and ')}. Then apply_writes calls LastValue.update with two values and raises ${errorName}. A later get_state reads the same pending writes and raises again, through ${getStateFrames}. invoke(None) reapplies the writes, runs no node, and raises again. In the lower block, the same saver is opened by the graph recompiled with ${fixedSchema}. get_state returns ${fixedState}, and invoke(None) finishes with the same state and runs no node.`,
}, f => {
  const term = forms.flat.terminal(f, CODE, 30, 'violet');
  const loop = forms.flat.unit(f, LOOP, 32, 'indigo');
  const nodes = forms.flat.unit(f, NODES, 32, 'indigo');
  const saver = forms.flat.cylinder(f, SAVER, 22, 'teal', { w: 40, h: 46 });
  f.text(CODE, 84, 'your code', { size: 11.5, anchor: 'middle', hue: 'violet' });
  f.text(LOOP, 84, 'Pregel loop', { size: 11.5, anchor: 'middle', hue: 'indigo' });
  f.text(NODES, 84, 'nodes a, b', { size: 11.5, anchor: 'middle', hue: 'indigo' });
  f.text(SAVER, 84, 'InMemorySaver', { size: 11.5, anchor: 'middle', hue: 'teal' });
  for (const x of [CODE, LOOP, NODES, SAVER]) f.lifeline(x, 92, 584);

  const row = (n, y, hue) => f.step(20, y, n, { hue });
  let y = 116;
  f.beat(1);
  row(1, y, 'ink');
  f.arrow([CODE, y], [LOOP - 2, y], { style: 'call', label: "invoke({'x': 0})" });
  y += 34;
  f.beat(2);
  row(2, y, 'ink');
  f.arrow([LOOP, y], [NODES - 2, y], { style: 'call', label: `run ${ran.join(', ')}` });
  y += 34;
  f.beat(3);
  row(3, y, 'teal');
  pending.forEach((p, k) => {
    const yy = y + k * 24;
    f.arrow([NODES, yy], [SAVER - 22, yy], { style: 'write', label: `${p.node}: ${p.channel}=${p.value}`, labelX: 470 });
  });
  y += 56;
  f.beat(4);
  row(4, y, 'rose');
  f.rect(LOOP - 60, y - 13, 120, 22, { hue: 'rose' });
  f.text(LOOP, y + 3, 'apply_writes', { size: 11.5, anchor: 'middle', hue: 'rose', weight: 700 });
  f.text(LOOP + 70, y + 3, 'LastValue gets two values', { size: 11, serif: true, hue: 'ink-soft', knock: true });
  y += 30;
  f.arrow([LOOP - 2, y], [CODE + 2, y], { style: 'fail', label: errorName });
  y += 40;
  f.beat(5);
  row(5, y, 'rose');
  f.arrow([CODE, y], [LOOP - 2, y], { style: 'call', label: 'get_state' });
  f.arrow([LOOP, y], [SAVER - 22, y], { style: 'call', label: `read step ${ckptStep} + pending`, labelX: 400 });
  y += 26;
  f.arrow([LOOP - 2, y], [CODE + 2, y], { style: 'fail', label: `${errorName} again` });
  y += 38;
  f.beat(6);
  row(6, y, 'rose');
  f.arrow([CODE, y], [LOOP - 2, y], { style: 'call', label: 'invoke(None)' });
  f.text(LOOP + 12, y + 4, `nodes run: ${resumeRan}, writes reapplied`, { size: 11, serif: true, hue: 'ink-soft', knock: true });
  y += 26;
  f.arrow([LOOP - 2, y], [CODE + 2, y], { style: 'fail', label: `${errorName} again` });

  y += 30;
  f.beat(7);
  f.rule(14, y, 626, y, { hue: 'ink-mute', dash: 'dashed' });
  f.text(36, y + 18, 'same saver, graph recompiled', { size: 11.5, hue: 'teal', weight: 700, knock: true });
  f.text(36, y + 36, `with ${fixedSchema}`, { size: 11, hue: 'teal', knock: true });
  y += 62;
  row(7, y, 'teal');
  f.arrow([CODE, y], [LOOP - 2, y], { style: 'call', label: 'get_state' });
  y += 24;
  f.arrow([LOOP - 2, y], [CODE + 2, y], { style: 'reply', label: fixedState });
  y += 34;
  f.beat(8);
  row(8, y, 'teal');
  f.arrow([CODE, y], [LOOP - 2, y], { style: 'call', label: 'invoke(None)' });
  f.text(LOOP + 12, y + 4, `nodes run: ${fixedRan}, saved writes reduced: 0 + 1 + 2`, { size: 11, serif: true, hue: 'ink-soft', knock: true });
  y += 24;
  f.arrow([LOOP - 2, y], [CODE + 2, y], { style: 'reply', label: fixedState });
});
