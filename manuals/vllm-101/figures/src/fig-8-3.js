'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-8-3', {
  height: 280,
  title: 'One pool of 16-token blocks serves every request',
  desc: 'The KV cache is a pool of 16-token blocks. Each request has a block table that maps its token positions to block numbers anywhere in the pool. Full blocks are listed in a hash map for prefix hits. Free blocks wait in a queue, and the least recently used cached block is evicted first.',
}, f => {
  f.kicker(20, 18, 'block pool on the GPU');
  const used = { 2: 'blue', 3: 'blue', 7: 'blue', 5: 'violet', 6: 'violet', 10: 'violet', 11: 'green', 12: 'green' };
  for (let i = 0; i < 16; i += 1) {
    const x = 20 + (i % 8) * 76;
    const y = 30 + Math.floor(i / 8) * 46;
    const hue = used[i] || 'grey';
    f.box({ x, y, w: 68, h: 38, hue, dash: used[i] ? undefined : 'dashed', title: `#${i}`, titleSize: 11.5 });
  }
  f.kicker(20, 150, 'block tables');
  f.box({ x: 20, y: 160, w: 190, h: 44, hue: 'blue', title: 'request A', sub: '#2, #3, #7' });
  f.box({ x: 226, y: 160, w: 190, h: 44, hue: 'violet', title: 'request B', sub: '#5, #6, #10' });
  f.box({ x: 432, y: 160, w: 188, h: 44, hue: 'green', title: 'cached prefix', sub: '#11, #12 by hash' });
  f.text(20, 236, 'Dashed blocks are free and wait in a queue. A request takes one block each time it fills 16 tokens.', { size: 11.5, serif: true, hue: 'ink-soft' });
  f.text(20, 258, 'When the queue is empty, the least recently used cached block is evicted first.', { size: 11.5, serif: true, hue: 'ink-soft' });
});
