'use strict';

const { figure } = require('../../../_shared/figkit.js');

const steps = [
  { decode: 8, prefill: 2040, label: 'step 1' },
  { decode: 8, prefill: 2040, label: 'step 2' },
  { decode: 8, prefill: 16, label: 'step 3' },
];

module.exports = figure('fig-8-2', {
  height: 250,
  title: 'One 2,048-token budget per step: decode first, prompt chunks fill the rest',
  desc: 'Three scheduler steps with the default budget of 2,048 tokens. Eight running requests take one decode token each, and a new 4,096-token prompt fills the rest in chunks of 2,040 tokens. In step 3 the last 16 prompt tokens run, and the new request decodes from step 4.',
}, f => {
  const scale = 520 / 2048;
  f.kicker(20, 18, 'budget of each step, --max-num-batched-tokens 2048');
  steps.forEach((s, index) => {
    const y = 34 + index * 58;
    f.text(20, y + 24, s.label, { size: 12, weight: 700 });
    const dw = Math.max(s.decode * scale, 14);
    f.rect(90, y, dw, 36, { hue: 'amber' });
    const pw = s.prefill * scale;
    f.rect(90 + dw + 2, y, pw, 36, { hue: 'plum' });
    if (pw > 200) f.text(90 + dw + 12, y + 23, `${s.prefill.toLocaleString('en-US')} prompt tokens of the new request`, { size: 11.5, hue: 'plum' });
    else f.text(160, y + 23, 'the last 16 prompt tokens, decode starts in step 4', { size: 11.5, hue: 'ink-soft' });
    if (90 + dw + 2 + pw < 600) f.rect(90 + dw + 4 + pw, y, 600 - (90 + dw + 4 + pw) + 10, 36, { hue: 'grey', dash: 'dashed' });
  });
  f.rect(20, 214, 12, 12, { hue: 'amber' });
  f.text(40, 224, 'decode, one token for each running request', { size: 11.5, serif: true, hue: 'ink-soft' });
  f.rect(340, 214, 12, 12, { hue: 'plum' });
  f.text(360, 224, 'a chunk of a new prompt', { size: 11.5, serif: true, hue: 'ink-soft' });
});
