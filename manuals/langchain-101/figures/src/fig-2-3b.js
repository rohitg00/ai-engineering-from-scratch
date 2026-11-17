'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const dir = path.join(__dirname, '../../capture/lab/internals/03-checkpoint');
const run1 = load(path.join(dir, 'crash.json'));
const run2 = load(path.join(dir, 'taskns.json'));
const cellsOf = data => {
  const out = {};
  for (const row of data.rows) (out[`${row.mode}/${row.wait_s.toFixed(1)}`] ||= []).push(row.category);
  return out;
};
const c1 = cellsOf(run1);
const c2 = cellsOf(run2);
const CELLS = ['sync/0.0', 'async/0.0', 'sync/0.2', 'async/0.2', 'exit/0.0', 'exit/0.2'];
for (const key of CELLS.slice(0, 4)) if (!c1[key] || !c2[key]) throw new Error(`fig-2-3b: missing cell ${key}`);
const reran = cats => cats.filter(c => c === 'a and c').length;
const pooled = mode => reran(c1[`${mode}/0.0`]) + reran(c2[`${mode}/0.0`]);
const total = mode => c1[`${mode}/0.0`].length + c2[`${mode}/0.0`].length;

const KIND = {
  'a and c': { fill: color('rose-ink'), stroke: color('rose-ink') },
  'only c': { fill: color('teal-ink'), stroke: color('teal-ink') },
  'nothing to resume': { fill: color('ink-mute'), stroke: color('ink-mute') },
};
const ORDER = ['a and c', 'only c', 'nothing to resume'];
const HUE = { 'a and c': 'rose', 'only c': 'teal', 'nothing to resume': 'ink-mute' };
const G1 = 112;
const G2 = 372;
const PITCH = 4.2;

module.exports = figure('fig-2-3b', {
  height: 340,
  title: 'What the resume ran after a crash in the middle of a superstep',
  desc: `Dot rows for a crash test on SqliteSaver with Qwen3 4B on the x86 server guest. Nodes a, b, and c run in parallel: a asks the model for a fruit, b calls a weather tool, and c exits the process after a and b returned and a wait of 0 or 0.2 seconds. A new process resumes the thread. Each dot is one trial, 50 per cell, two runs. With no wait, sync reran the model node a in ${reran(c1['sync/0.0'])} and ${reran(c2['sync/0.0'])} trials, ${pooled('sync')} of ${total('sync')}, and async in ${reran(c1['async/0.0'])} and ${reran(c2['async/0.0'])}, ${pooled('async')} of ${total('async')}. The tool node b never ran again. With a 0.2 second wait every trial reran only c. In exit mode no checkpoint existed in all 100 trials of run 1. Run 2 did not include exit.`,
}, f => {
  f.kicker(G1, 24, 'run 1');
  f.kicker(G2, 24, 'run 2');
  f.text(20, 24, 'mode, wait', { size: 11, hue: 'ink-mute' });
  CELLS.forEach((key, r) => {
    const [mode, wait] = key.split('/');
    const y = 52 + r * 32;
    f.beat(r + 1);
    f.text(20, y + 4, mode, { size: 12, weight: 700, hue: 'indigo' });
    f.text(70, y + 4, `${wait} s`, { size: 11, hue: 'ink-soft' });
    [[c1[key], G1], [c2[key], G2]].forEach(([cats, gx]) => {
      if (!cats) {
        f.text(gx, y + 4, 'not run', { size: 11, serif: true, hue: 'ink-mute' });
        return;
      }
      let k = 0;
      for (const kind of ORDER) {
        const n = cats.filter(x => x === kind).length;
        if (!n) continue;
        const d = Array.from({ length: n }, (_, j) => `M${(gx + 2 + (k + j) * PITCH).toFixed(1)} ${y}h0.01`).join('');
        f.path(d, { hue: HUE[kind], dash: 'dotted', width: 3.6, head: false, packet: false });
        k += n;
      }
      const n = reran(cats);
      const none = cats.filter(c => c === 'nothing to resume').length;
      f.text(gx + cats.length * PITCH + 6, y + 4, none ? 'none' : `${n}/${cats.length}`, { size: 11, hue: n ? 'rose' : 'ink-soft' });
    });
    if (r === 1 || r === 3) f.rule(16, y + 16, 624, y + 16, { hue: 'ink-mute', opacity: 0.35 });
  });
  f.beat(0);
  const ky = 260;
  const key = [['a and c', 'reran a and c'], ['only c', 'reran only c'], ['nothing to resume', 'nothing to resume']];
  key.forEach(([kind, name], i) => {
    const x = 26 + i * 180;
    f.emit(`<circle cx="${x}" cy="${ky - 4}" r="4" fill="${KIND[kind].fill}" stroke="${KIND[kind].stroke}" stroke-width="1.2"/>`);
    f.text(x + 10, ky, name, { size: 11, serif: true, hue: 'ink-soft' });
  });
  f.text(20, 292, `zero wait, pooled: sync reran a in ${pooled('sync')} of ${total('sync')}, async in ${pooled('async')} of ${total('async')}`, { size: 11.5, weight: 700, hue: 'rose' });
  f.text(20, 314, 'the tool node b never ran again, and a 0.2 s wait left only c to rerun', { size: 11, serif: true, hue: 'ink-soft' });
});
