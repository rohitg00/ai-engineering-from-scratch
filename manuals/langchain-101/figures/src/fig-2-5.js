'use strict';

const fs = require('fs');
const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');

const text = fs.readFileSync(path.join(__dirname, '../../capture/lab/internals/05-streaming/trace.txt'), 'utf8');
const partA = text.slice(text.indexOf('# A.'), text.indexOf('# C.'));
const items = [...partA.matchAll(/^\s+([\d.]+) ms\s+(\w+)\s+(.*)$/gm)].map(m => ({ t: Number(m[1]), mode: m[2], rest: m[3] }));
const MODES = ['tasks', 'messages', 'custom', 'updates', 'values', 'checkpoints', 'debug'];
for (const mode of MODES) if (!items.some(i => i.mode === mode)) throw new Error(`fig-2-5: no ${mode} item`);

const starts = items.filter(i => i.mode === 'tasks' && i.rest.startsWith('start'));
const valuesAt = items.filter(i => i.mode === 'values');
const bands = starts.map(s => ({ name: s.rest.split(' ')[1], from: s.t, to: valuesAt.find(v => v.t > s.t).t }));
const HUE = { tasks: 'amber', messages: 'plum', custom: 'green', updates: 'indigo', values: 'indigo', checkpoints: 'teal', debug: 'ink-soft' };
const counts = Object.fromEntries(MODES.map(m => [m, items.filter(i => i.mode === m).length]));
const last = Math.max(...items.map(i => i.t));
const firstText = items.find(i => i.mode === 'messages' && /text='[^']+'/.test(i.rest) && i.t > bands[2].from);

const SEGS = [
  { a: 0, b: 8, x: 126, w: 70, step: 4 },
  { a: 1893, b: 1901.4, x: 214, w: 170, step: 2 },
  { a: 2600, b: Math.ceil(last / 100) * 100 + 20, x: 402, w: 196, step: 200 },
];
const X = t => {
  const s = SEGS.find(g => t >= g.a && t <= g.b);
  if (!s) throw new Error(`fig-2-5: ${t} ms falls in an axis break`);
  return s.x + ((t - s.a) / (s.b - s.a)) * s.w;
};
const RY = 70;
const RH = 28;

module.exports = figure('fig-2-5', {
  height: 440,
  title: 'Where each stream mode is produced in one agent run',
  desc: `Seven rows, one per stream mode, on a time axis in milliseconds for one create_agent run with Qwen3 4B on the x86 server guest, all modes on and version v2. The axis has three zoomed spans with breaks: the start, the end of the first model step and the tools step around 1.9 s, and the answer from 2.6 s. The supersteps are ${bands.map(b => `${b.name} from ${b.from} to ${b.to} ms`).join(', ')}. Each tick is one item: ${MODES.map(m => `${m} ${counts[m]}`).join(', ')}. messages, custom, and updates items appear while a task runs or as it finishes. A values item comes after the update phase. The checkpoints and debug items of a step appear at the start of the next superstep, together with the tasks start item. The answer tokens arrived from ${firstText.t} ms, about one every 67 ms.`,
}, f => {
  f.kicker(20, 30, 'stream mode');
  bands.forEach(b => {
    SEGS.forEach(s => {
      const a = Math.max(b.from, s.a);
      const z = Math.min(b.to, s.b);
      if (z <= a) return;
      if (b.name === 'tools') f.rect(X(a), RY - 22, X(z) - X(a), MODES.length * RH + 10, { fill: color('code-bg'), stroke: 'none' });
    });
  });
  SEGS.forEach((s, i) => {
    if (i) {
      const bx = s.x - 9;
      f.rule(bx - 3, RY - 22, bx + 3, RY - 26, { hue: 'ink-mute' });
      f.rule(bx - 3, RY + MODES.length * RH - 8, bx + 3, RY + MODES.length * RH - 12, { hue: 'ink-mute' });
    }
  });
  f.text(X(4), RY - 30, 'start', { size: 11, anchor: 'middle', hue: 'ink-soft' });
  f.text(X(1893), RY - 30, 'model ends', { size: 11, hue: 'plum' });
  f.text(X(1899), RY - 30, 'tools', { size: 11, anchor: 'middle', hue: 'green' });
  f.text(X(2950), RY - 30, 'model answers', { size: 11, anchor: 'middle', hue: 'plum' });
  MODES.forEach((mode, r) => {
    const y = RY + r * RH;
    f.beat(r + 1);
    f.text(20, y + 4, mode, { size: 11.5, hue: HUE[mode] === 'ink-soft' ? 'ink' : HUE[mode] });
    SEGS.forEach(s => f.rule(s.x, y, s.x + s.w, y, { hue: 'ink-mute', opacity: 0.25 }));
    const here = items.filter(i => i.mode === mode);
    const seen = {};
    here.forEach(i => {
      const k = seen[i.t] || 0;
      seen[i.t] = k + 1;
      const x = X(i.t) + k * 3;
      f.rule(x, y - 9, x, y + 9, { hue: HUE[mode], width: 2 });
    });
    f.text(624, y + 4, String(here.length), { size: 11, anchor: 'end', hue: 'ink-soft' });
  });
  const axisY = RY + MODES.length * RH - 6;
  SEGS.forEach(s => {
    for (let t = Math.ceil(s.a / s.step) * s.step; t <= s.b; t += s.step) {
      f.rule(X(t), axisY, X(t), axisY + 4, { hue: 'ink' });
      f.text(X(t), axisY + 18, String(t), { size: 11, anchor: 'middle', hue: 'ink-soft' });
    }
  });
  f.text(20, axisY + 18, 'ms', { size: 11, hue: 'ink-soft' });

  f.beat(8);
  const tool = bands.find(b => b.name === 'tools');
  const upd = items.find(i => i.mode === 'updates' && i.t > tool.from);
  const val = items.find(i => i.mode === 'values' && i.t > tool.from);
  const ck = items.find(i => i.mode === 'checkpoints' && i.t >= val.t);
  const cus = items.find(i => i.mode === 'custom');
  const yOf = m => RY + MODES.indexOf(m) * RH;
  const marks = [
    [X(cus.t) - 16, yOf('custom') - 14, 1],
    [X(upd.t) - 16, yOf('updates') - 14, 2],
    [X(val.t) + 16, yOf('values') - 14, 3],
    [X(ck.t) + 16, yOf('checkpoints') - 14, 4],
  ];
  marks.forEach(([x, y, n]) => f.step(x, y, n));

  f.beat(0);
  const notes = [
    [1, `custom: the tool calls stream_writer at ${cus.t} ms, inside the tools task`],
    [2, `updates: the tools task finishes at ${upd.t} ms, and its writes go out at once`],
    [3, `values: after the update phase of the superstep, at ${val.t} ms`],
    [4, `checkpoints: emitted when the next superstep plans, at ${ck.t} ms`],
  ];
  notes.forEach(([n, line], k) => {
    const y = axisY + 46 + k * 22;
    f.step(30, y, n);
    f.text(46, y + 4, line, { size: 11, serif: true, hue: 'ink-soft' });
  });
});
