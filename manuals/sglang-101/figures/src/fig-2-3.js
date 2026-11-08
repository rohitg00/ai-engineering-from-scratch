'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

const LEFT = 70;
const SCALE = 0.12;
const POOL = 4096;
const px = tokens => LEFT + tokens * SCALE;

module.exports = figure('fig-2-3', {
  height: 250,
  title: 'Why five requests fit in 4,096 tokens and six do not',
  desc: 'Two bars show a KV pool of 4,096 tokens. In the first, five requests each reserve 256 prompt tokens and 512 output tokens, 3,840 tokens in all, with 256 tokens free. In the second, a sixth request would need 768 more tokens and runs 512 tokens past the end of the pool, so the scheduler keeps it waiting.',
}, f => {
  const end = px(POOL);
  f.rule(end, 30, end, 176, { hue: 'ink', dash: 'dashed' });
  f.text(end + 4, 26, 'pool end', { size: 11, hue: 'ink-soft' });

  f.kicker(LEFT, 26, 'admitted: five requests');
  for (let i = 0; i < 5; i += 1) {
    const x = px(i * 768);
    f.rect(x, 36, 256 * SCALE, 28, { hue: 'green' });
    f.rect(x + 256 * SCALE, 36, 512 * SCALE, 28, { hue: 'amber' });
  }
  f.rect(px(3840), 36, 256 * SCALE, 28, { hue: 'grey' });
  f.text(LEFT, 84, 'each request reserves 256 prompt + 512 output = 768 tokens', { size: 11, serif: true, hue: 'ink-soft' });

  f.kicker(LEFT, 120, 'a sixth request would need 4,608');
  for (let i = 0; i < 5; i += 1) {
    const x = px(i * 768);
    f.rect(x, 130, 256 * SCALE, 28, { hue: 'green' });
    f.rect(x + 256 * SCALE, 130, 512 * SCALE, 28, { hue: 'amber' });
  }
  f.rect(px(3840), 130, 256 * SCALE, 28, { hue: 'green' });
  f.rect(end, 130, 512 * SCALE, 28, { fill: color('rose-fill'), stroke: color('rose-ink'), dash: 'dashed' });

  f.rule(LEFT, 182, end, 182, { hue: 'ink' });
  f.rule(LEFT, 178, LEFT, 186, { hue: 'ink' });
  f.rule(px(3840), 178, px(3840), 186, { hue: 'ink' });
  f.rule(end, 178, end, 186, { hue: 'ink' });
  f.text(LEFT, 200, '0', { size: 11, hue: 'ink-soft', anchor: 'middle' });
  f.text(px(3840) - 3, 200, '3,840', { size: 11, hue: 'ink-soft', anchor: 'end' });
  f.text(end + 3, 200, '4,096', { size: 11, hue: 'ink-soft' });

  const legend = [['green', 'prompt KV', 70], ['amber', 'reserved output', 190], ['grey', 'free', 350], ['rose', 'does not fit', 430]];
  for (const [hue, label, x] of legend) {
    f.rect(x, 222, 14, 12, { hue, dash: hue === 'rose' ? 'dashed' : undefined });
    f.text(x + 20, 232, label, { size: 11, serif: true, hue: 'ink-soft' });
  }
});
