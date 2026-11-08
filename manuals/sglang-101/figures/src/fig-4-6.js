'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-4-6', {
  height: 420,
  title: 'One EAGLE step with steps 3, topk 1, and 4 draft tokens',
  desc: 'Four stages top to bottom. The draft model runs three steps and proposes draft tokens d1, d2, and d3. The target model runs one forward in TARGET_VERIFY mode over the draft positions. It accepts d1 and d2, rejects d3, and adds its own bonus token, so three tokens are committed and the acceptance length is 3. The draft model then reads the accepted tokens in DRAFT_EXTEND_V2 mode for the next step.',
}, f => {
  f.beat(1);
  f.kicker(20, 18, '1 · draft, num_steps 3, topk 1');
  const drafts = ['d1', 'd2', 'd3'].map((name, index) => {
    f.beat(index + 1);
    if (index) f.arrow([20 + (index - 1) * 150 + 120, 50], [20 + index * 150 - 1, 50], { style: 'model' });
    return f.box({ x: 20 + index * 150, y: 28, w: 120, h: 44, hue: 'plum', title: name, sub: `draft step ${index + 1}` });
  });
  f.beat(4);
  f.kicker(20, 104, '2 · verify, one target forward');
  f.arrow([320, drafts[0].y + drafts[0].h], [320, 113], { style: 'call', label: '4 draft tokens', labelX: 320 });
  const verify = f.box({ x: 20, y: 114, w: 600, h: 48, hue: 'violet', title: 'target model, ForwardMode TARGET_VERIFY', sub: 'scores d1, d2, d3 and the next position with a tree mask' });
  f.beat(5);
  f.kicker(20, 196, '3 · accept the longest match');
  f.arrow([310, verify.y + verify.h], [310, 205], { style: 'reply' });
  const results = [
    { title: 'd1', sub: 'accepted', hue: 'green' },
    { title: 'd2', sub: 'accepted', hue: 'green' },
    { title: 'd3', sub: 'rejected', hue: 'rose', dash: 'dashed' },
    { title: 'bonus', sub: 'from the target', hue: 'green' },
  ];
  results.forEach((item, index) => f.box({ x: 20 + index * 150, y: 206, w: 130, h: 46, ...item }));
  f.beat(6);
  f.kicker(20, 286, '4 · commit and refill');
  f.box({ x: 20, y: 296, w: 290, h: 56, hue: 'amber', title: 'commit 3 tokens', sub: ['acceptance length 3', 'd1, d2, bonus'] });
  f.beat(7);
  f.arrow([310, 324], [329, 324], { style: 'model' });
  f.box({ x: 330, y: 296, w: 290, h: 56, hue: 'plum', title: 'draft model, DRAFT_EXTEND_V2', sub: ['reads d1, d2, bonus', 'ready for the next step'] });
  f.text(20, 384, 'without speculation the same three tokens take three target forwards', { size: 11, serif: true, hue: 'ink-soft' });
});
