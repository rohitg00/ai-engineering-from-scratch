'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');
const lane = require('../lib/swimlane.js');

const S = load(path.join(__dirname, '../../capture/lab/summary/multiagent-mac.json'));
const TASK = 'multi07';
const runs = S.patterns.map(p => {
  const r = S.lanes[`${TASK}|${p}`];
  if (!r) throw new Error(`fig-6-7d: no recorded run of ${TASK} for ${p}`);
  return r;
});
const tmax = Math.ceil(Math.max(...runs.map(r => Math.max(...r.events.map(e => e.t1)))) / 5) * 5;
const multi = runs.some(r => r.turn_calls.length > 1);
const body = runs.reduce((h, r) => h + lane.panelHeight(r), 0);
const height = 20 + body + 30 + (multi ? 44 : 28);

module.exports = figure('fig-6-7d', {
  height,
  title: `One recorded run of ${TASK} through each pattern`,
  desc: `Five swim-lane panels, one per pattern, for task ${TASK} on Claude Haiku 5.5, on a shared time axis of ${tmax} seconds. Each lane is one agent, each plum box is one model call, and each triangle is one tool call. ${runs.map(r => `${lane.PATTERN_NAME[r.pattern]}: ${r.calls} model calls, ${r.in} input tokens, ${r.wall.toFixed(1)} s, ${r.passed ? 'pass' : 'fail'}`).join('; ')}.`,
}, f => {
  let y = 12;
  runs.forEach((r, i) => {
    y += lane.panel(f, { x: 16, y, w: 608, run: r, tmax, beat: i + 1 });
  });
  f.beat(6);
  y += lane.axis(f, { x: 16, y: y - 4, w: 608, tmax, step: tmax > 20 ? 5 : 2 });
  lane.legend(f, { x: 16, y: y + 12, turns: multi });
});
