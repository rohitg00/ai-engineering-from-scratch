'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-3-5', {
  height: 330,
  title: 'One prefix through the three HiCache tiers',
  desc: 'Three tiers from left to right: L1 is the GPU KV pool, L2 is pinned host memory private to the instance, and L3 is a storage backend such as file, mooncake, hf3fs, or nixl. Under write_through, a node is copied to L2 on its first hit, and write_through_selective waits for the second hit. Eviction from L1 leaves the host copy. A later match loads the host part back into fresh GPU slots one layer ahead of compute. A storage prefetch is skipped when the L3 hit is under 256 tokens.',
}, f => {
  const l1 = f.box({ x: 20, y: 40, w: 150, h: 70, hue: 'green', title: 'L1 · GPU pool', sub: ['device memory', 'requests and cache'] });
  const l2 = f.box({ x: 245, y: 40, w: 150, h: 70, hue: 'teal', title: 'L2 · host', sub: ['pinned memory', 'one instance only'] });
  const l3 = f.box({ x: 470, y: 40, w: 150, h: 70, hue: 'teal', title: 'L3 · storage', sub: ['shared by servers', 'file, mooncake'] });
  f.kicker(20, 150, 'when a prefix gets a host copy');
  const rows = [
    ['write_through (default)', 'on its first hit · threshold 1'],
    ['write_through_selective', 'on its second hit · threshold 2'],
    ['write_back', 'only when L1 evicts it'],
  ];
  rows.forEach(([policy, rule], index) => {
    const y = 162 + index * 34;
    f.box({ x: 20, y, w: 230, h: 28, hue: 'amber', title: policy, titleSize: 12, align: 'left' });
    f.text(266, y + 19, rule, { size: 12, serif: true });
  });
  f.kicker(20, 282, 'storage prefetch at v0.5.22');
  f.text(20, 304, 'skipped under 256 matching tokens · stops after 1.0 s + 0.25 s per 1,024 tokens', { size: 11.5, serif: true, hue: 'ink-soft' });
  f.beat(1);
  f.arrow([l1.x + l1.w, 60], [l2.x - 1, 60], { style: 'write', label: 'copy' });
  f.beat(2);
  f.arrow([l2.x + l2.w, 60], [l3.x - 1, 60], { style: 'write', label: 'back up' });
  f.beat(3);
  f.arrow([l3.x - 1, 96], [l2.x + l2.w + 1, 96], { style: 'reply', label: 'fetch' });
  f.beat(4);
  f.arrow([l2.x - 1, 96], [l1.x + l1.w + 1, 96], { style: 'reply', label: 'load' });
});
