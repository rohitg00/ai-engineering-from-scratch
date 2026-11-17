'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const drill = load(path.join(__dirname, '../../capture/lab/summary/failure-drill-x86.json'));
const by = n => drill.cases[String(n)].runs[0];
const c1 = by(1);
const c2 = by(2);
const c3 = by(3);
const c4 = by(4);
const c5 = by(5);
const c7 = by(7);

const rows = [
  ['retry layers', `${c1.requests} requests, ${c1.run_s} s`, 'every connection dropped', `${c1.requests_after_fix} requests, ${c1.run_s_after_fix} s`, 'max_retries=0 on the model'],
  ['crash after a charge', `${c2.charges} charges`, 'SIGKILL, then a resume', `${c2.charges_after_fix} with the key`, 'one per call id of the model'],
  ['jump past review', `ran ${c3.ran_before_decision} time, no decision`, 'batched mode', `ran ${c3.ran_after_fix} times, 1 interrupt`, 'interrupt_mode per_call'],
  ['no structured output', `None in ${c4.none_count} of ${c4.runs.length} prompts`, 'ToolStrategy and a tool', 'your check raises', 'test for None'],
  ['tracing endpoint down', `exit ${c5.exit_lag_s} s after the run`, 'one run, nothing listens', `exit ${c5.exit_lag_s_after_fix} s after the run`, 'probe, then tracing off'],
  ['same tool name twice', '1 tool bound, no error', 'the refunds function ran', 'duplicate found', 'check names first'],
  ['endless tool calls', `raised at ${c7.model_calls} model calls`, 'recursion_limit 10', `ended at ${c7.after_fix[1].model_calls} calls`, 'call limit 3, recursion 25'],
];

module.exports = figure('fig-8-7', {
  height: 470,
  title: 'Seven failures of the drill, before and after each fix',
  desc: `A table of seven rows, one per case of the failure drill with Qwen3 4B on the x86 server guest, with the symptom on the left and the result after the fix on the right. Retry layers: ${c1.requests} requests against ${c1.requests_after_fix}. A crash after a charge: ${c2.charges} charges against ${c2.charges_after_fix} with the key, because the model asked for two charges. A middleware that jumps past review: the tool ran before any decision, and per-call mode stopped it. No structured output: None with no exception in ${c4.none_count} of ${c4.runs.length} prompts, and a check that raises. A tracing endpoint that is down: exit ${c5.exit_lag_s} s after the run against ${c5.exit_lag_s_after_fix} s. The same tool name twice: one tool bound with no error. Endless tool calls: GraphRecursionError at limit 10, and a model call limit of 3 that ends the run after 3 calls, with the recursion limit raised to 25.`,
}, f => {
  f.kicker(176, 20, 'the symptom');
  f.kicker(408, 20, 'after the fix');
  rows.forEach(([label, left, leftSub, right, rightSub], i) => {
    const y = 32 + i * 58;
    f.text(20, y + 27, label, { size: 11.5, weight: 700, max: 150 });
    f.box({ x: 176, y, w: 220, h: 46, hue: 'rose', title: left, sub: leftSub, align: 'left', titleSize: 12 });
    f.box({ x: 408, y, w: 212, h: 46, hue: 'teal', title: right, sub: rightSub, align: 'left', titleSize: 12 });
  });
  f.text(20, 452, 'The first of three runs of drill.py with Qwen3 4B on Ollama, on the x86 server guest.', { size: 11, serif: true, hue: 'ink-soft' });
});
