'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/prodapp-mac/summary/fix-mac.json'));
const CASE = 'new_message_while_waiting_for_approval';
const MODELS = [['qwen3-4b', 'Qwen3 4B'], ['qwen3-14b', 'Qwen3 14B']];
const rowsOf = rep => (rep.refund_rows || {})[CASE] || [];
const proposed = rep => (rep.approvals_and_results || []).find(p => p.case === CASE && p.amount_cents !== undefined);
const result = rep => (rep.approvals_and_results || []).find(p => p.case === CASE && p.result);
const sample = proposed(data.after['qwen3-14b'][0]) || proposed(data.after['qwen3-4b'][0]);
const desc = sample.description.split('. ');

module.exports = figure('fig-9-3b', {
  height: 330,
  title: 'The zero-cent refund before and after the tool checks the amount',
  desc: `The eval asks to refund ORD-e19-3 and approves what the model proposes. Before the fix, ${MODELS.map(([k, l]) => `${l} wrote ${data.before[k].filter(r => rowsOf(r).length).length} zero-cent rows in ${data.before[k].length} runs`).join(', ')}. After the fix, ${MODELS.map(([k, l]) => `${l} wrote ${data.after[k].filter(r => rowsOf(r).length).length} rows in ${data.after[k].length} runs`).join(', ')}. The approval text after the fix: ${sample.description}`,
}, f => {
  f.kicker(150, 22, 'before the fix');
  f.kicker(400, 22, 'after the fix');
  MODELS.forEach(([key, label], m) => {
    const y = 44 + m * 80;
    f.text(16, y + 22, label, { size: 11.5, weight: 700 });
    f.text(16, y + 38, 'refund ORD-e19-3', { size: 11, serif: true, hue: 'ink-soft' });
    data.before[key].forEach((rep, i) => {
      const rows = rowsOf(rep);
      const bad = rows.some(r => r.amount_cents === 0);
      f.box({ x: 150 + i * 78, y, w: 74, h: 52, pad: 4, hue: bad ? 'rose' : 'teal', title: `run ${i + 1}`, sub: [bad ? '0-cent row' : `${rows.length} rows`] });
    });
    data.after[key].forEach((rep, i) => {
      const rows = rowsOf(rep);
      const p = proposed(rep);
      const refused = result(rep) && /must be positive/.test(result(rep).result);
      f.box({ x: 400 + i * 78, y, w: 74, h: 52, pad: 4, hue: rows.length ? 'rose' : 'teal', title: `run ${i + 1}`, sub: [p ? `${p.amount_cents} asked` : 'none asked', refused ? 'refused' : `${rows.length} rows`] });
    });
  });
  f.kicker(16, 222, 'what the approver read after the fix');
  desc.forEach((line, i) => f.text(16, 244 + i * 16, line.endsWith('.') ? line : `${line}.`, { size: 11, serif: true, max: 608 }));
});
