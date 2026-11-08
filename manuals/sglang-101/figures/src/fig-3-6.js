'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-3-6', {
  height: 290,
  title: 'A Mamba prefix resumes only at a snapshot',
  desc: 'A cached conversation drawn as a token ribbon from 0 to 2,048 tokens, with Mamba state snapshots every 256 tokens. A new request matches the first 1,800 tokens. Full-attention KV exists for all 1,800 tokens, but the recurrent state exists only at snapshots, so the request resumes from the snapshot at 1,792 tokens and prefills tokens 1,792 to 1,800 again.',
}, f => {
  const scale = 560 / 2048;
  f.kicker(20, 20, 'cached conversation · 2,048 tokens');
  f.rect(40, 32, 560, 26, { hue: 'green' });
  for (let token = 0; token <= 2048; token += 256) {
    const x = 40 + token * scale;
    f.rule(x, 58, x, 70, { hue: 'teal', width: 2 });
    if (token % 512 === 0) f.text(x, 86, token.toLocaleString('en-US'), { size: 11, anchor: 'middle', hue: 'ink-mute' });
  }
  f.text(40, 106, 'teal ticks: Mamba state snapshots, every 256 tokens', { size: 11, serif: true, hue: 'ink-soft' });
  f.kicker(20, 140, 'new request · matches 1,800 tokens');
  const resume = 40 + 1792 * scale;
  const match = 40 + 1800 * scale;
  f.rect(40, 152, resume - 40, 26, { hue: 'green' });
  f.rect(resume, 152, match - resume, 26, { hue: 'plum' });
  f.rule(resume, 146, resume, 186, { hue: 'teal', width: 2 });
  f.text(40, 204, 'reused: 1,792 tokens, up to the last snapshot', { size: 11.5, hue: 'green' });
  f.text(40, 224, 'prefilled again: 8 tokens from 1,792 to 1,800', { size: 11.5, hue: 'plum' });
  f.text(40, 256, 'Full-attention KV exists for every token. The recurrent state', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(40, 274, 'exists only where a snapshot was saved.', { size: 11, serif: true, hue: 'ink-soft' });
});
