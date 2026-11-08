'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-3-2', {
  height: 270,
  title: 'A prefix hit reuses whole 16-token blocks up to the first difference',
  desc: 'Two prompts share a system prompt. Each full 16-token block gets a hash that includes the hash of the block before it. The second prompt finds the first three block hashes in the map and reuses those blocks. Its fourth block differs, so the chain stops and the rest is computed.',
}, f => {
  f.kicker(20, 18, 'request A, already served');
  f.kicker(620, 122, 'request B, arrives later', { anchor: 'end' });
  const labels = ['h1', 'h2', 'h3', 'h4a', 'h5a'];
  const labelsB = ['h1', 'h2', 'h3', 'h4b', 'h5b'];
  for (let i = 0; i < 5; i += 1) {
    f.box({ x: 20 + i * 120, y: 28, w: 108, h: 46, hue: 'green', title: `block ${i + 1}`, sub: labels[i] });
    const hit = i < 3;
    f.box({ x: 20 + i * 120, y: 128, w: 108, h: 46, hue: hit ? 'green' : 'plum', dash: hit ? undefined : 'dashed', title: hit ? 'cache hit' : 'compute', sub: labelsB[i] });
  }
  for (let i = 0; i < 3; i += 1) f.arrow([74 + i * 120, 127], [74 + i * 120, 75], { style: 'reply' });
  f.text(446, 98, 'differs here, chain stops', { size: 11.5, hue: 'rose', weight: 700 });
  f.text(20, 206, 'Each hash covers its 16 tokens and the hash before it, so h3 names the first 48 tokens.', { size: 11.5, serif: true, hue: 'ink-soft' });
  f.text(20, 228, 'A shared part of 20 tokens gives one cached block, and 4 tokens are always computed.', { size: 11.5, serif: true, hue: 'ink-soft' });
  f.text(20, 250, 'Put the shared part first, in the same order, to keep the chain long.', { size: 11.5, serif: true, hue: 'ink-soft' });
});
