'use strict';

const fs = require('fs');
const path = require('path');
const { figure } = require('../../../_shared/figkit.js');

const read = name => fs.readFileSync(path.join(__dirname, '../../capture/lab/internals', name), 'utf8');

const channels = read('02-channels/trace.txt');
const orderRuns = [...channels.matchAll(/^slow node=(\w+): finish order \(node, model seconds\)=\[(.*)\]\s+merged list=\[([^\]]*)\]$/gm)].map(m => ({
  label: `${m[1]} asked for 60 words`,
  finished: [...m[2].matchAll(/\('(\w+)', ([\d.]+)\)/g)].map(x => ({ name: x[1], s: Number(x[2]) })),
  applied: m[3].split(',').map(s => s.trim().replace(/'/g, '')),
  kinds: {},
}));
if (orderRuns.length !== 6) throw new Error('fig-2-1b: expected six finish-order runs');

const send = read('06-send-command/trace.txt');
const partB = send.slice(send.indexOf('## B.'), send.indexOf('## C.'));
const step2 = partB.slice(partB.indexOf('PLAN step=2'));
const finished = [...step2.matchAll(/^\s+done (\w+)\s/gm)].map(m => ({ name: m[1], s: null }));
const update = /UPDATE order=\[([^\]]*)\]/.exec(step2)[1];
const applied = [...update.matchAll(/"(\w+)@\('(__pregel_\w+)'/g)].map(m => ({ name: m[1], kind: m[2] }));
const kinds = Object.fromEntries(applied.map(a => [a.name, a.kind]));
const mixed = { label: 'Command and Send', finished, applied: applied.map(a => a.name), kinds };
const runs = [...orderRuns, mixed];
const bFirst = orderRuns.filter(r => r.finished[0].name === 'b').length;
const sameMerge = orderRuns.filter(r => r.applied.join() === 'a,b').length;

const LX = 210;
const RX = 452;
const BW = 64;
const BH = 24;
const GAP = 12;
const RH = 46;

module.exports = figure('fig-2-1b', {
  height: 440,
  title: 'The order tasks finish against the order their writes apply',
  desc: `Seven supersteps with two parallel tasks each, recorded with Qwen3 4B on the x86 server guest. On the left, the tasks in the order they returned, with the seconds of their model call. On the right, the order in which apply_writes applied their writes. In six runs, nodes a and b each ask the model for an answer and append to one list with operator.add. b returned first in ${bFirst} of 6 runs, and the list was a, b in ${sameMerge} of 6. In the last superstep, node ${applied[0].name} was started by Command(goto) as a PULL task and node ${applied[1].name} by a Send as a PUSH task. ${finished[0].name} finished first, and ${applied[0].name} still applied first, because PULL paths sort before PUSH paths.`,
}, f => {
  f.kicker(LX, 22, 'order they returned');
  f.kicker(RX, 22, 'order applied');
  f.text(LX, 40, 'model seconds under each', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(RX, 40, 'sorted by task path', { size: 11, serif: true, hue: 'ink-soft' });
  runs.forEach((run, r) => {
    const y = 60 + r * RH + (r === runs.length - 1 ? 16 : 0);
    f.beat(r + 1);
    f.text(20, y + 16, run.label, { size: 11.5, hue: 'ink' });
    run.finished.forEach((t, k) => {
      const push = run.kinds[t.name] === '__pregel_push';
      const b = f.box({ x: LX + k * (BW + GAP), y, w: BW, h: BH, hue: 'amber', title: t.name, titleSize: 12, dash: push ? 'dashed' : undefined, pad: 4 });
      f.text(b.cx, y + BH + 13, t.s === null ? (push ? 'PUSH' : 'PULL') : `${t.s.toFixed(2)} s`, { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });
    });
    run.applied.forEach((name, k) => {
      const push = run.kinds[name] === '__pregel_push';
      const b = f.box({ x: RX + k * (BW + GAP), y, w: BW, h: BH, hue: 'indigo', title: name, titleSize: 12, dash: push ? 'dashed' : undefined, pad: 4 });
      const label = run.kinds[name] ? (push ? 'PUSH' : 'PULL') : `item ${k + 1}`;
      f.text(b.cx, y + BH + 13, label, { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });
    });
    f.arrow([LX + 2 * BW + GAP + 8, y + BH / 2], [RX - 8, y + BH / 2], { style: 'state', label: r === 0 ? 'apply_writes' : undefined });
  });
  f.beat(0);
  f.rule(16, 60 + 6 * RH + 4, 624, 60 + 6 * RH + 4, { hue: 'ink-mute', opacity: 0.4 });
  f.rect(20, 418, 22, 14, { hue: 'amber', dash: 'dashed' });
  f.text(48, 429, 'a PUSH task from a Send', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(300, 429, `b back first in ${bFirst} of 6, merged a, b in ${sameMerge} of 6`, { size: 11, hue: 'indigo' });
});
