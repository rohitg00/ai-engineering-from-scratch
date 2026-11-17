'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/prodapp-mac/summary/crash-mac.json'));
const one = data.map.find(t => t.marks && t.marks.killed);
const m = one.marks;
const t0 = m.approve_sent;
const at = key => m[key] - t0;
const end = Math.ceil(at('resumed_done') + 1);
const forms = ['map', 'plain'].filter(k => data[k]);
const count = (rows, test) => rows.filter(test).length;

module.exports = figure('fig-9-3', {
  height: 400,
  title: 'A worker killed after the refund row, and the restart',
  desc: `Top: one trial on the Mac with Qwen3 4B. The approve was sent at 0 s, the refund row was in Postgres at ${at('refund_row_seen').toFixed(1)} s, and SIGKILL came at ${at('killed').toFixed(1)} s. A new process read the thread at ${at('state_read').toFixed(1)} s and found next ${JSON.stringify(one.after_restart_next)} with the approval ${one.approval_re_asked ? 'asked again' : 'answered'}. Bottom: ${forms.map(k => `${k} resume value, ${count(data[k], t => t.refund_rows === 1 && t.refunded_cents === 8900)} of ${data[k].length} trials with one refund row, approval asked again in ${count(data[k], t => t.approval_re_asked)}`).join('. ')}.`,
}, f => {
  const c = chart(f, { x: 150, y: 40, w: 460, h: 150, xDomain: [-1, end], yDomain: [0, 3], xTicks: Array.from({ length: Math.floor(end / 2) + 1 }, (_, i) => i * 2), yTicks: [], xLabel: 'seconds after the first approve was sent' });
  const lane = (y, label, sub) => {
    f.text(16, c.py(y) + 4, label, { size: 11.5, weight: 700 });
    if (sub) f.text(16, c.py(y) + 18, sub, { size: 11, serif: true, hue: 'ink-soft' });
  };
  lane(2.5, 'worker 1');
  lane(1.5, 'worker 2', 'after restart');
  lane(0.5, 'Postgres', 'refunds table');
  f.rect(c.px(-1), c.py(2.5) - 7, c.px(at('killed')) - c.px(-1), 14, { hue: 'indigo' });
  f.text(c.px(at('killed')) + 6, c.py(2.5) + 4, 'SIGKILL', { size: 11, hue: 'rose', weight: 700 });
  f.rect(c.px(at('restarted')), c.py(1.5) - 7, c.px(at('resumed_done')) - c.px(at('restarted')), 14, { hue: 'indigo' });
  f.line(c.px(at('refund_row_seen')), c.py(2.5) + 8, c.px(at('refund_row_seen')), c.py(0.5) - 6, { style: 'write' });
  f.dot(c.px(at('refund_row_seen')), c.py(0.5), { hue: 'teal', r: 4 });
  f.text(c.px(at('refund_row_seen')) + 8, c.py(0.5) + 4, 'one row, 8900 cents', { size: 11, hue: 'teal' });
  f.line(c.px(at('resumed_done')) - 2, c.py(1.5) + 8, c.px(at('resumed_done')) - 2, c.py(0.5) - 6, { style: 'reply', hue: 'teal' });
  f.text(c.px(at('resumed_done')) - 6, c.py(0.5) + 18, 'same key, replayed true', { size: 11, hue: 'teal', anchor: 'end' });
  f.rule(c.px(at('state_read')), c.py(1.5) - 12, c.px(at('state_read')), c.py(1.5) + 12, { hue: 'amber', width: 2 });
  f.text(c.px(at('state_read')) - 4, c.py(1.5) - 16, one.approval_re_asked ? 'approval asked again' : 'approval kept', { size: 11, hue: 'amber', anchor: 'end' });
  f.dot(c.px(0), c.py(2.5), { hue: 'ink', r: 3 });
  f.text(c.px(0) + 6, c.py(2.5) - 12, 'approve', { size: 11 });

  f.kicker(16, 262, 'every trial');
  forms.forEach((form, r) => {
    const y = 280 + r * 46;
    f.text(16, y + 13, `${form} resume value`, { size: 11.5, weight: 700 });
    data[form].forEach((t, i) => {
      const x = 186 + i * 22;
      const ok = t.refund_rows === 1 && t.refunded_cents === 8900;
      f.rect(x, y, 16, 16, { hue: ok ? 'teal' : 'rose' });
      if (t.approval_re_asked) f.rect(x - 2, y - 2, 20, 20, { fill: 'none', hue: 'amber' });
    });
    const one = count(data[form], t => t.refund_rows === 1 && t.refunded_cents === 8900);
    const asked = count(data[form], t => t.approval_re_asked);
    f.text(186, y + 32, `${one} of ${data[form].length} one refund row, approval asked again in ${asked}`, { size: 11, serif: true, hue: 'ink-soft' });
  });
});
