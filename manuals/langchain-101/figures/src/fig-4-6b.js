'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const S = load(path.join(__dirname, '../../capture/lab/bench2/summary-bench2.json'));
const R = S.rubric;
const ids = Object.keys(R.tasks);
const T = R.tasks;
const VERDICT = { satisfied: 'green', needs_revision: 'amber', max_iterations_reached: 'rose' };
const last = t => (T[t].results || []).slice(-1)[0];
const satFail = ids.filter(t => last(t) === 'satisfied' && !T[t].pass);
const sat = ids.filter(t => last(t) === 'satisfied');
const maxIt = ids.filter(t => last(t) === 'max_iterations_reached');
const SQ = 10;
const STEP = 12;
const VX = 84;
const RH = 15;
const Y0 = 74;

module.exports = figure('fig-4-6b', {
  height: Y0 + ids.length * RH + 70,
  title: 'RubricMiddleware on the 25 tasks that Qwen3 8B failed as a plain loop',
  desc: `One row for each of the ${ids.length} tasks that a plain loop of Qwen3 8B failed, rerun with create_agent and RubricMiddleware with Qwen3 14B as the grader. Squares give each grader verdict in order. ${sat.length} runs ended with the verdict satisfied and ${satFail.length} of those still failed the state checker. ${maxIt.length} runs reached the limit of three rounds. ${R.recovered.length} tasks passed: ${R.recovered.join(', ')}.`,
}, f => {
  f.kicker(20, 22, 'grader verdicts, in order');
  f.text(404, 40, 'worker calls', { size: 11, anchor: 'end', hue: 'ink-mute' });
  f.text(20, 56, 'task', { size: 11, hue: 'ink-soft' });
  f.text(VX, 56, 'verdicts', { size: 11, hue: 'ink-soft' });
  f.text(212, 56, 'state check', { size: 11, hue: 'ink-soft' });
  f.text(350, 56, 'plain', { size: 11, anchor: 'end', hue: 'ink-soft' });
  f.text(404, 56, 'rubric', { size: 11, anchor: 'end', hue: 'ink-soft' });
  f.text(466, 56, 'grader', { size: 11, anchor: 'end', hue: 'ink-soft' });
  f.text(486, 56, 'failure left', { size: 11, hue: 'ink-soft' });
  f.rule(20, 62, 620, 62, { hue: 'ink-mute' });
  ids.forEach((t, i) => {
    const y = Y0 + i * RH;
    const v = T[t];
    f.text(20, y + 9, t, { size: 11, hue: 'ink' });
    (v.results || []).slice(0, 9).forEach((r, j) => {
      f.rect(VX + j * STEP, y, SQ, SQ, { fill: color(`${VERDICT[r]}-ink`), stroke: 'none' });
    });
    f.rect(212, y, SQ, SQ, { fill: color(v.pass ? 'blue-ink' : 'rose-ink'), stroke: 'none' });
    f.text(228, y + 9, v.pass ? 'pass' : 'fail', { size: 11, hue: v.pass ? 'blue' : 'rose', weight: v.pass ? 700 : 400 });
    f.text(350, y + 9, String(v.base_calls), { size: 11, anchor: 'end', hue: 'ink' });
    f.text(404, y + 9, String(v.calls), { size: 11, anchor: 'end', hue: 'ink' });
    f.text(466, y + 9, String(v.judge_calls), { size: 11, anchor: 'end', hue: 'ink' });
    f.text(486, y + 9, v.pass ? 'none' : v.cat, { size: 11, hue: 'ink-soft', max: 134 });
  });
  const y = Y0 + ids.length * RH + 16;
  f.beat(1);
  [['satisfied', 'satisfied'], ['needs_revision', 'needs revision'], ['max_iterations_reached', 'round limit']].forEach(([k, label], i) => {
    f.rect(20 + i * 130, y - 9, SQ, SQ, { fill: color(`${VERDICT[k]}-ink`), stroke: 'none' });
    f.text(34 + i * 130, y, label, { size: 11, hue: 'ink-soft' });
  });
  f.beat(0);
  f.text(20, y + 20, `${sat.length} runs ended satisfied and ${satFail.length} of them failed the check. ${R.recovered.length} of ${ids.length} tasks passed.`, { size: 11, serif: true, hue: 'ink' });
  f.text(20, y + 36, `Worker calls ${R.worker_calls[0]} to ${R.worker_calls[1]}, plus ${R.judge_calls} grader calls.`, { size: 11, serif: true, hue: 'ink-soft' });
});
