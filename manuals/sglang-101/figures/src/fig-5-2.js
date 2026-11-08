'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-5-2', {
  height: 196,
  title: 'One server, two cache hit rates',
  desc: 'Left, the cache_hit_rate gauge, overwritten on each log interval, reads 0.942 for the last prefill interval. Right, the device_hit counter at 182,079 tokens and the input counter at 104,057 tokens give 182,079 divided by 286,136, which is 0.636 over the whole run.',
}, f => {
  f.kicker(20, 18, 'A · the gauge');
  f.kicker(340, 18, 'B · the counters');
  f.rule(320, 8, 320, 188, { dash: 'dashed' });
  f.box({ x: 20, y: 32, w: 280, h: 52, hue: 'blue', title: 'sglang:cache_hit_rate', sub: ['gauge, overwritten each log interval'] });
  f.text(160, 128, '0.942', { size: 22, anchor: 'middle', hue: 'green', weight: 700 });
  f.text(160, 152, 'the last prefill interval only', { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });
  f.box({ x: 340, y: 32, w: 130, h: 52, hue: 'green', title: 'device_hit', sub: ['182,079 tokens'] });
  f.box({ x: 490, y: 32, w: 130, h: 52, hue: 'plum', title: 'input', sub: ['104,057 tokens'] });
  f.rule(405, 84, 405, 110, { hue: 'ink' });
  f.rule(555, 84, 555, 110, { hue: 'ink' });
  f.box({ x: 340, y: 110, w: 280, h: 52, hue: 'grey', title: '182,079 / 286,136 = 0.636', sub: ['all prefill since the server started'] });
});
