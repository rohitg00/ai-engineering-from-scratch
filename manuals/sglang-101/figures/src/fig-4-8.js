'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-4-8', {
  height: 330,
  title: 'One constrained request from arrival to sampling',
  desc: 'A request with a json_schema arrives at the grammar manager, which looks up the key json plus schema in the grammar cache. On a hit the request goes straight to the waiting queue. On a miss, compilation runs in a thread pool and the request waits in the grammar queue until the grammar is ready on every rank. During each decode step the grammar fills a vocabulary bitmask that masks the logits before the sampler picks a token, and the grammar then accepts the token.',
}, f => {
  const req = f.box({ x: 20, y: 30, w: 190, h: 48, hue: 'olive', title: 'request', sub: 'sampling_params.json_schema' });
  const cache = f.box({ x: 240, y: 30, w: 170, h: 48, hue: 'blue', title: 'grammar cache', sub: 'key ("json", schema)' });
  const waiting = f.box({ x: 460, y: 30, w: 160, h: 48, hue: 'amber', title: 'waiting queue', sub: 'can be scheduled' });
  f.arrow(req.right(), [239, 54], { style: 'call' });
  f.arrow(cache.right(), [459, 54], { style: 'state', label: 'hit' });
  const pool = f.box({ x: 240, y: 130, w: 170, h: 48, hue: 'blue', title: 'thread pool', sub: 'compiles, gives a future' });
  const gq = f.box({ x: 460, y: 130, w: 160, h: 48, hue: 'amber', title: 'grammar queue', sub: 'ready on every rank?' });
  f.arrow(cache.bottom(), pool.top(), { style: 'call', label: 'miss' });
  f.arrow(pool.right(), [459, 154], { style: 'state' });
  f.arrow(gq.top(), waiting.bottom(), { style: 'state', label: 'ready' });
  const logits = f.box({ x: 20, y: 240, w: 170, h: 48, hue: 'violet', title: 'logits', sub: 'one row per request' });
  const mask = f.box({ x: 240, y: 240, w: 170, h: 48, hue: 'blue', title: 'vocab bitmask', sub: 'invalid tokens removed' });
  const sampler = f.box({ x: 460, y: 240, w: 160, h: 48, hue: 'violet', title: 'sampler', sub: 'picks a valid token' });
  f.arrow(logits.right(), [239, 264], { style: 'model' });
  f.arrow(mask.right(), [459, 264], { style: 'model' });
  f.kicker(20, 226, 'every decode step');
  f.text(20, 316, 'after sampling, the grammar accepts the token and moves its state', { size: 11, serif: true, hue: 'ink-soft' });
});
