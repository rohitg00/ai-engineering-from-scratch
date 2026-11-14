'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/demos-mac.json'));
const steps = data.assistant.default;
const names = ['remember', 'ask to send', 'approve', 'resume', 'approve again', 'third turn', 'new thread t2'];
const X0 = 216;
const COL = 81;
const ROW = 40;
const Y0 = 62;
const cols = [
  [['next', 'node'], s => (s.next.length ? s.next[0] : 'none'), 'amber'],
  [['check-', 'points'], s => String(s.checkpoints), 'teal'],
  [['approvals', 'waiting'], s => String(s.pending), 'amber'],
  [['send_email', 'runs'], s => String(s.attempts), 'green'],
  [['emails', 'sent'], s => String(s.sent), 'teal'],
];

module.exports = figure('fig-8-3', {
  height: 418,
  title: 'Seven processes of the assistant, and what each one left behind',
  desc: `A table with one row for each of the seven processes of the assistant run on the Mac, and one column for each count read when the process ended. Process 3 approved the email, sent it, and was killed with exit code ${steps[2].exit}. Process 4 resumed and found the same approval waiting again. Process 5 approved again, send_email ran a second time, and the key check skipped the send. At the end send_email had run ${steps[6].attempts} times and the outbox held ${steps[6].sent} email. Process 7 on a new thread still found ${steps[6].memories} memories in the store.`,
}, f => {
  cols.forEach(([head], c) => head.forEach((line, k) => f.text(X0 + c * COL + (COL - 8) / 2, 22 + k * 15, line, { size: 11, anchor: 'middle', hue: 'ink-soft', weight: 700 })));
  steps.forEach((s, i) => {
    const y = Y0 + i * ROW;
    f.text(20, y + 21, `${i + 1}`, { size: 12, weight: 700, hue: s.exit ? 'rose' : 'ink' });
    f.text(40, y + 21, names[i], { size: 11.5, hue: s.exit ? 'rose' : 'ink' });
    if (s.exit !== 0) {
      f.rect(X0, y, 5 * COL - 8, ROW - 8, { fill: color('rose-fill'), stroke: color('rose-ink'), dash: 'dashed' });
      f.text(X0 + 10, y + 21, `SIGKILL, exit ${s.exit}: email sent, step not saved`, { size: 11.5, hue: 'rose', weight: 700 });
      return;
    }
    cols.forEach(([, value, hue], c) => {
      const x = X0 + c * COL;
      f.rect(x, y, COL - 8, ROW - 8, { fill: color(`${hue}-fill`), stroke: color(`${hue}-ink`) });
      f.text(x + (COL - 8) / 2, y + 21, value(s), { size: 12, anchor: 'middle', hue, weight: 700 });
    });
  });
  f.text(20, Y0 + 7 * ROW + 16, 'Each row is one new Python process, on thread t1 unless named.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, Y0 + 7 * ROW + 34, 'The counts were read when the process ended. send_email ran twice and', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, Y0 + 7 * ROW + 52, 'one email was sent, because the second run found its tool_call_id in', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, Y0 + 7 * ROW + 70, 'the outbox. Checkpoints count the rows of the thread in that row.', { size: 11, serif: true, hue: 'ink-soft' });
});
