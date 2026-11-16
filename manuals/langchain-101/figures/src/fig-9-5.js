'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const lab = path.join(__dirname, '../../capture/lab/prodapp-mac/summary');
const faults = load(path.join(lab, 'faults-mac.json'));
const evals = load(path.join(lab, 'evals-mac.json'));
const replies = evals.causes.replies;
const MODELS = evals.models.filter(m => faults[m.key]);
const ROWS = [
  ['flaky_faq_is_retried', 'search_faq fails', 'once'],
  ['hung_tool_times_out', 'read_order hangs', 'every attempt'],
  ['failed_ticket_is_not_retried', 'create_ticket', 'fails once'],
  ['primary_outage_uses_backup', 'primary model', 'raises'],
  ['runaway_loop_hits_call_limit', 'model asks for', 'search_faq forever'],
];
const TOP = 80;
const ROW = 58;
const COL = 100;
const X0 = 340;

module.exports = figure('fig-9-5', {
  height: TOP + ROWS.length * ROW + 10,
  title: 'Five faults, the attempts in the spans, and what each model told the customer',
  desc: `For each injected fault, the tool and model spans of the first suite run on the Mac, and the reply of ${MODELS.map(m => m.label).join(', ')}. ${ROWS.map(([key, a, b]) => `${a} ${b}: ${MODELS.map(m => `${m.label} ${(replies[m.key] || {})[key] ? replies[m.key][key].join(' ') : 'not run'}`).join(', ')}`).join('. ')}.`,
}, f => {
  f.kicker(16, 24, 'fault');
  f.kicker(176, 24, 'spans of the run');
  MODELS.forEach((m, i) => f.text(X0 + i * COL + 4, 24, m.label.replace('Claude ', ''), { size: 11, weight: 700 }));
  f.rect(176, 36, 10, 10, { hue: 'green' });
  f.text(190, 45, 'tool ok', { size: 11, hue: 'ink-soft' });
  f.rect(250, 36, 10, 10, { hue: 'rose' });
  f.text(264, 45, 'error', { size: 11, hue: 'ink-soft' });
  f.rect(176, 52, 10, 10, { hue: 'plum' });
  f.text(190, 61, 'model call ok', { size: 11, hue: 'ink-soft' });
  ROWS.forEach(([key, a, b], r) => {
    const y = TOP + r * ROW;
    f.rule(16, y - 6, 630, y - 6, { hue: 'ink-mute', opacity: 0.4 });
    f.text(16, y + 12, a, { size: 11.5, weight: 700 });
    f.text(16, y + 27, b, { size: 11, serif: true, hue: 'ink-soft' });
    const source = MODELS.find(m => faults[m.key][key].tools.length) || MODELS[0];
    const ref = faults[source.key][key];
    const primary = key === 'primary_outage_uses_backup';
    const marks = primary ? ref.model_calls.map(c => (c.error ? 'rose' : 'plum')) : ref.tools.map(t => (t.error ? 'rose' : 'green'));
    marks.forEach((hue, k) => f.rect(176 + k * 14, y + 2, 10, 12, { hue }));
    const tag = primary ? 'model.call: primary, backup' : `${ref.tools.length} tool span${ref.tools.length === 1 ? '' : 's'}, ${source.label.replace('Claude ', '')}`;
    f.text(176, y + 30, tag, { size: 11, serif: true, hue: 'ink-soft' });
    MODELS.forEach((m, i) => {
      const reply = (replies[m.key] || {})[key];
      const x = X0 + i * COL;
      if (!reply) {
        f.text(x + 4, y + 12, 'not run', { size: 11, hue: 'ink-mute' });
        return;
      }
      const [line1, line2, verdict] = reply;
      const bad = verdict === 'bad';
      f.rect(x, y, COL - 8, 38, { hue: bad ? 'rose' : 'plum', dash: bad ? 'dashed' : undefined });
      f.text(x + 6, y + 15, line1, { size: 11, serif: true, max: COL - 14 });
      if (line2) f.text(x + 6, y + 30, line2, { size: 11, serif: true, max: COL - 14 });
    });
  });
});
