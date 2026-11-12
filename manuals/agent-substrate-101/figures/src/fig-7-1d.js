'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/kagent-model-x86.json'));
const groups = [
  { key: 'A-3b', name: '3b, one session' },
  { key: 'C-3b-first', name: '3b, new' },
  { key: 'A-1p5b', name: '1.5b, one session' },
  { key: 'C-1p5b-first', name: '1.5b, new' },
];
const GAP = 1.4;
const TOP = 22;
const BAR = 6.4;
const one = value => `${value.toFixed(1)} s`;
const stuck = data.turn_that_did_not_end;
const total = groups.reduce((sum, group) => sum + data.runs[group.key].length, 0);
const clean = groups.reduce((sum, group) => sum + data.series[group.key].clean, 0);
const share = data.series['A-3b'].model_share.median;
const overhead = data.series['A-3b'].resume_seconds.median + data.series['A-3b'].suspend_seconds.median;

let cursor = 0.6;
for (const group of groups) {
  group.from = cursor;
  group.turns = data.runs[group.key].map((turn, index) => ({ ...turn, at: cursor + index + 0.5 }));
  cursor += group.turns.length + GAP;
}
const span = cursor - GAP + 0.6;

module.exports = figure('fig-7-1d', {
  height: 372,
  title: 'Every kagent turn with a small real model on CPU',
  desc: `All ${total} turns of the kagent run with a small open model on CPU, one bar each, in the order of the run. The plum part of a bar is the time of the model requests and the amber part is the rest of the turn, which holds the resume and the suspend. With the 3b model, a turn in one session took a median of ${one(data.series['A-3b'].wall_seconds.median)} and the model was ${Math.round(share * 100)} percent of it. With the 1.5b model the median was ${one(data.series['A-1p5b'].wall_seconds.median)}. ${clean} turns were clean. One turn with the 1.5b model did not end: the client gave up after ${Math.round(stuck.client_seconds)} seconds, and the next turn waited ${Math.round(stuck.next_turn_wall_seconds)} seconds behind it.`,
}, f => {
  const c = chart(f, { x: 56, y: 62, w: 560, h: 222, xDomain: [0, span], yDomain: [0, TOP], yTicks: [0, 5, 10, 15, 20], yLabel: 'seconds for each turn at the client' });
  f.kicker(56, 22, 'model requests', { hue: 'plum' });
  f.kicker(206, 22, 'the rest of the turn', { hue: 'amber' });
  f.kicker(616, 22, 'no answer, or waited', { hue: 'rose', anchor: 'end' });
  groups.forEach((group, index) => {
    const left = c.px(group.from);
    const right = c.px(group.from + group.turns.length);
    const stats = data.series[group.key];
    const divider = left - c.px(GAP / 2) + c.px(0);
    if (index) f.rule(divider, 62, divider, 284, { hue: 'ink-mute', dash: 'dashed', opacity: 0.6 });
    for (const turn of group.turns) {
      const x = c.px(turn.at) - BAR / 2;
      if (!turn.clean) {
        const top = c.py(TOP);
        f.rect(x, top, BAR, c.py(0) - top, { hue: 'rose' });
        f.hatchRect(x, top, BAR, c.py(0) - top);
        continue;
      }
      const model = c.py(turn.model_seconds);
      const wall = c.py(turn.wall_seconds);
      f.rect(x, model, BAR, c.py(0) - model, { hue: 'plum' });
      f.rect(x, wall, BAR, model - wall, { hue: 'amber' });
    }
    if (stats.clean === stats.n) {
      const my = c.py(stats.wall_seconds.median);
      f.rule(left - 2, my, right + 2, my, { hue: 'ink', width: 1.2 });
      f.text((left + right) / 2, c.py(20.6), one(stats.wall_seconds.median), { size: 12, weight: 700, anchor: 'middle', knock: true });
    }
    f.text((left + right) / 2, 302, group.name, { size: 11, anchor: 'middle' });
    f.text((left + right) / 2, 317, `${stats.clean} of ${stats.n} clean`, { size: 11, anchor: 'middle', serif: true, hue: 'ink-soft' });
  });
  const last = groups[3];
  const lost = last.turns.find(turn => !turn.completed);
  const waited = last.turns.find(turn => turn.completed && !turn.clean);
  f.text(616, 52, `${Math.round(lost.wall_seconds)} s with no answer, then ${Math.round(waited.wall_seconds)} s`, { size: 11, anchor: 'end', hue: 'rose' });
  f.text(56, 344, `one bar: one turn, in run order. black line: the median of a series with no failed turn.`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(56, 359, `resume plus suspend: about ${overhead.toFixed(1)} s of each turn. qwen2.5 on 12 CPUs, no GPU.`, { size: 11, serif: true, hue: 'ink-soft' });
});
