'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-1-3', {
  height: 300,
  title: 'One request through the three vLLM processes',
  desc: 'A client sends HTTP to the API server process, which tokenizes and sends the request over ZeroMQ to the engine core process. The engine core schedules it and sends the batch to a GPU worker, one for each GPU. Token ids come back the same way, and the API server streams text to the client.',
}, f => {
  f.kicker(20, 18, 'you');
  f.kicker(160, 18, 'process 1');
  f.kicker(330, 18, 'process 2');
  f.kicker(500, 18, 'one for each GPU');
  const client = f.box({ x: 20, y: 40, w: 116, h: 64, hue: 'olive', title: 'client', sub: ['curl, OpenAI', 'SDK, bench'] });
  const api = f.box({ x: 160, y: 40, w: 150, h: 64, hue: 'blue', title: 'API server', sub: ['HTTP routes', 'tokenizer'] });
  const core = f.box({ x: 330, y: 40, w: 150, h: 64, hue: 'blue', title: 'engine core', sub: ['Scheduler', 'KVCacheManager'] });
  const worker = f.box({ x: 500, y: 40, w: 120, h: 64, hue: 'violet', title: 'GPU worker', sub: ['GPUModelRunner', 'forward pass'] });
  f.arrow([136, 62], [159, 62], { style: 'call' });
  f.arrow([310, 62], [329, 62], { style: 'call' });
  f.arrow([480, 62], [499, 62], { style: 'call' });
  f.arrow([499, 88], [481, 88], { style: 'reply' });
  f.arrow([329, 88], [311, 88], { style: 'reply' });
  f.arrow([159, 88], [137, 88], { style: 'event' });
  f.step(148, 50, 1);
  f.step(320, 50, 2);
  f.step(490, 50, 3);
  const keyed = [
    [1, 'HTTP request, text in', 140],
    [2, 'ZeroMQ message, token ids', 164],
    [3, 'shared memory queue, one batch per step', 188],
  ];
  keyed.forEach(([n, label, y]) => {
    f.step(42, y - 4, n);
    f.text(72, y, label, { size: 11.5, serif: true, hue: 'ink-soft' });
  });
  f.line(24, 208, 60, 208, { style: 'reply', head: false });
  f.text(72, 212, 'token ids back, one step at a time', { size: 11.5, serif: true, hue: 'ink-soft' });
  f.line(24, 232, 60, 232, { style: 'event', head: false });
  f.text(72, 236, 'text streamed to the client', { size: 11.5, serif: true, hue: 'ink-soft' });
  f.text(20, 280, 'A worker crash shows up in the engine core log. A slow tokenizer shows up as slow first tokens.', { size: 11, serif: true, hue: 'ink-soft' });
});
