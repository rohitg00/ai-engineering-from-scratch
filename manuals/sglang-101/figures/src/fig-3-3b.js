'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-3-3b', {
  height: 330,
  title: 'Two groups of the shared-prefix benchmark in one tree',
  desc: 'A radix tree with a root that has lock count 1 forever. Under it, the group 1 system prompt node holds 2,048 tokens and has lock count 2, because two running requests use it. It splits into two leaves of 128 question tokens, each with lock count 1. A second branch holds the group 2 system prompt with lock count 0, so it is cached and evictable. Eviction removes leaves with lock count 0 first, from the tip toward the root.',
}, f => {
  f.beat(1);
  const root = f.box({ x: 250, y: 20, w: 140, h: 44, hue: 'grey', title: 'root', sub: ['lock 1, forever'] });
  f.beat(2);
  const g1 = f.box({ x: 60, y: 110, w: 240, h: 52, hue: 'green', title: 'group 1 system prompt', sub: ['2,048 tokens · lock 2'] });
  f.line(root.cx - 30, root.y + root.h, g1.cx, g1.y, { style: 'call', head: false });
  f.beat(3);
  const qa = f.box({ x: 20, y: 216, w: 150, h: 52, hue: 'blue', title: 'question A', sub: ['128 tokens · lock 1'] });
  const qb = f.box({ x: 190, y: 216, w: 150, h: 52, hue: 'blue', title: 'question B', sub: ['128 tokens · lock 1'] });
  f.line(g1.cx - 40, g1.y + g1.h, qa.cx, qa.y, { style: 'call', head: false });
  f.line(g1.cx + 40, g1.y + g1.h, qb.cx, qb.y, { style: 'call', head: false });
  f.text(372, 236, 'match_prefix splits a node where', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(372, 252, 'two token runs stop agreeing.', { size: 11, serif: true, hue: 'ink-soft' });
  f.beat(4);
  const g2 = f.box({ x: 360, y: 110, w: 240, h: 52, hue: 'green', dash: 'dashed', title: 'group 2 system prompt', sub: ['2,048 tokens · lock 0 · evictable'] });
  f.line(root.cx + 30, root.y + root.h, g2.cx, g2.y, { style: 'call', head: false });
  f.beat(5);
  f.text(20, 300, 'A lock count above 0 protects the whole path to the root. evict frees leaves with lock 0', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 318, 'first, oldest access time first, and moves up the branch.', { size: 11, serif: true, hue: 'ink-soft' });
});
