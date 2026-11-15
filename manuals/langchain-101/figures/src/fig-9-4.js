'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { chart, load } = require('../../../_shared/chart.js');

const cost = load(path.join(__dirname, '../../capture/lab/prodapp-mac/summary/cost-mac.json'));
const model = cost.models.haiku;
const convs = Object.entries(model.conversations).filter(([, c]) => c.billed_input > 0).sort(([a], [b]) => a.localeCompare(b));
const total = c => c.billed_input;
const yMax = Math.ceil(Math.max(...convs.map(([, c]) => total(c))) / 5000) * 5000;
const inside = convs.reduce((s, [, c]) => s + c.input, 0);
const outside = convs.reduce((s, [, c]) => s + c.billed_input - c.input, 0);
const ledger = model.ledger;

module.exports = figure('fig-9-4', {
  height: 330,
  title: 'Input tokens per eval conversation with Claude Haiku 5.5, inside and outside model.call spans',
  desc: `${convs.length} conversations. ${inside} input tokens sat inside model.call spans, case 16 left out and ${outside} were billed outside them: summarizer calls, and calls whose reply a test middleware replaced. The Anthropic usage for the whole suite was ${ledger.input_tokens} input tokens in ${ledger.calls} calls, ${ledger.cost_usd} dollars.`,
}, f => {
  f.rect(16, 12, 14, 10, { hue: 'plum' });
  f.text(36, 21, 'inside model.call spans', { size: 11 });
  f.rect(230, 12, 14, 10, { hue: 'rose' });
  f.text(250, 21, 'billed, but not in a model.call span', { size: 11 });
  const c = chart(f, { x: 60, y: 56, w: 560, h: 210, xDomain: [0, convs.length], yDomain: [0, yMax], xTicks: [], yTicks: Array.from({ length: yMax / 5000 + 1 }, (_, i) => i * 5000), yLabel: 'input tokens in the conversation' });
  const slot = 560 / convs.length;
  convs.forEach(([user, conv], i) => {
    const x = c.px(i) + slot * 0.2;
    const w = slot * 0.6;
    f.rect(x, c.py(conv.input), w, c.py(0) - c.py(conv.input), { hue: 'plum' });
    if (total(conv) > conv.input) f.rect(x, c.py(total(conv)), w, c.py(conv.input) - c.py(total(conv)), { hue: 'rose' });
    f.text(x + w / 2, 284, user.replace('e', ''), { size: 11, anchor: 'middle', hue: 'ink-soft' });
  });
  f.text(340, 310, 'eval conversation, by case number', { size: 11.5, anchor: 'middle', serif: true, hue: 'ink-soft' });
});
