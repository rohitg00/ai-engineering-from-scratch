'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/prodapp-mac/summary/evals-mac.json'));

const ROWS = [
  ['test_eval[faq_return_window]', 'faq: return window'],
  ['test_eval[faq_shipping_time]', 'faq: delivery time'],
  ['test_eval[order_status]', 'order status'],
  ['test_eval[order_unknown]', 'unknown order'],
  ['test_eval[order_of_other_customer_is_hidden]', 'other customer order hidden'],
  ['test_eval[refund_approved_once]', 'refund approved once'],
  ['test_eval[refund_rejected_has_no_side_effect]', 'refund rejected, no row'],
  ['test_eval[refund_asked_twice]', 'refund asked twice'],
  ['test_eval[refund_tool_replay_is_idempotent]', 'refund tool replay'],
  ['test_eval[ticket_for_a_human]', 'ticket for a human'],
  ['test_eval[memory_saved_and_recalled]', 'memory saved, recalled'],
  ['test_eval[memory_of_other_user_is_invisible]', 'memory of other user'],
  ['test_eval[flaky_faq_is_retried]', 'flaky faq retried'],
  ['test_eval[hung_tool_times_out]', 'hung tool times out'],
  ['test_eval[failed_ticket_is_not_retried]', 'failed ticket not retried'],
  ['test_eval[primary_outage_uses_backup]', 'primary down, backup used'],
  ['test_eval[runaway_loop_hits_call_limit]', 'runaway loop, call limit'],
  ['test_eval[long_thread_is_summarized]', 'long thread summarized'],
  ['test_eval[new_message_while_waiting_for_approval]', 'message during approval'],
  ['test_eval[status_then_refund_in_one_thread]', 'status, then refund'],
  ['test_one_user_cannot_read_another_users_thread_or_memory', 'isolation: thread, memory'],
  ['test_missing_or_wrong_token_is_rejected', 'isolation: bad token 401'],
  ['test_kill_mid_refund_then_resume_refunds_once', 'crash mid refund, resume'],
  ['test_sigterm_lets_in_flight_run_finish', 'SIGTERM, run finishes'],
  ['test_sigterm_past_deadline_checkpoints_and_resumes', 'SIGTERM past deadline'],
  ['test_two_workers_racing_on_one_thread_give_one_run_and_one_409', 'two workers, one thread'],
  ['test_langsmith_receives_nothing_unless_enabled', 'LangSmith off'],
];
const LETTER = { ask: 'a', guess: 'g', zero: 'z', ticket: 't', nonote: 'n', nofaq: 'f', slow: 's', stream: 'c', harness: 'h', timing: 'w', other: 'o' };

const TOP = 62;
const ROW = 16;
const CELL = 18;
const GAP = 4;
const groups = [];
let x = 262;
for (const model of data.models) {
  const reps = Math.max(1, model.reps.length);
  groups.push({ model, x, reps });
  x += reps * (CELL + GAP) + 40;
}
const bottom = TOP + ROWS.length * ROW;
const keys = Object.entries(data.causes.codes);

module.exports = figure('fig-9-6', {
  height: bottom + 40 + keys.length * 15 + 8,
  title: 'The same 27 tests on three real models',
  desc: `Each row is one test of the reference service, and each column is one run of the whole suite. ${data.models.map(m => `${m.label}: ${m.reps.map(r => `${r.passed} of ${r.total}`).join(', ')}`).join('. ')}. A letter in a failed cell names the cause, with the key below the grid.`,
}, f => {
  for (const g of groups) {
    const width = g.reps * (CELL + GAP) - GAP;
    f.text(g.x + width / 2, 22, g.model.label.replace('Claude ', ''), { size: 11, anchor: 'middle', weight: 700 });
    g.model.reps.forEach((rep, i) => {
      const cx = g.x + i * (CELL + GAP) + CELL / 2;
      f.text(cx, 40, String(i + 1), { size: 11, anchor: 'middle', hue: 'ink-soft' });
      f.text(cx, 54, String(rep.passed), { size: 11, anchor: 'middle', hue: 'plum' });
    });
  }
  f.text(16, 40, 'run of the suite', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(16, 54, 'tests passed in the run', { size: 11, serif: true, hue: 'plum' });
  ROWS.forEach(([name, label], r) => {
    const y = TOP + r * ROW;
    if (r === 20) f.rule(16, y - 2, 630, y - 2, { hue: 'ink-mute', dash: 'dashed' });
    f.text(16, y + 11, label, { size: 11 });
    for (const g of groups) {
      const causes = data.causes[g.model.key] || {};
      g.model.reps.forEach((rep, i) => {
        const cx = g.x + i * (CELL + GAP);
        const outcome = rep.cases[name];
        if (!outcome) {
          f.rect(cx, y + 1, CELL, ROW - 2, { fill: 'none', stroke: color('ink-mute'), dash: 'dotted' });
          return;
        }
        if (outcome === 'passed') {
          f.rect(cx, y + 1, CELL, ROW - 2, { hue: 'plum' });
          return;
        }
        f.rect(cx, y + 1, CELL, ROW - 2, { hue: 'rose' });
        f.text(cx + CELL / 2, y + 11.5, LETTER[causes[name] || 'other'], { size: 11, anchor: 'middle', hue: 'rose', weight: 700 });
      });
    }
  });
  f.text(groups[groups.length - 1].x + 32, TOP + 21 * ROW + 12, 'service tests,', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(groups[groups.length - 1].x + 32, TOP + 22 * ROW + 12, 'not run on Claude', { size: 11, serif: true, hue: 'ink-soft' });
  keys.forEach(([code, text], k) => {
    const y = bottom + 30 + k * 15;
    f.text(16, y, LETTER[code], { size: 11, weight: 700, hue: 'rose' });
    f.text(32, y, text, { size: 11, serif: true, hue: 'ink-soft', max: 600 });
  });
});
