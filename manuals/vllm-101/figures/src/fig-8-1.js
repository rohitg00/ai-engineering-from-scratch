'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-8-1', {
  height: 270,
  title: 'A server with -tp 4 runs six processes',
  desc: 'vllm serve starts one API server process. It starts one engine core process, which runs the scheduler and the KV cache manager. The engine core starts one GPU worker for each GPU, four workers for tensor parallel size 4. Six processes in total.',
}, f => {
  const api = f.box({ x: 230, y: 20, w: 180, h: 48, hue: 'blue', title: 'API server', sub: 'HTTP, tokenizer' });
  const core = f.box({ x: 230, y: 104, w: 180, h: 48, hue: 'blue', title: 'engine core', sub: 'scheduler, KV manager' });
  f.arrow([320, 68], [320, 103], { style: 'event', label: 'ZeroMQ', labelX: 328 });
  for (let i = 0; i < 4; i += 1) {
    const x = 32 + i * 150;
    f.box({ x, y: 196, w: 126, h: 48, hue: 'violet', title: `worker ${i}`, sub: `GPU ${i}, rank ${i}` });
    f.path(`M320 152 V174 H${x + 63} V195`, { style: 'call' });
  }
  f.text(20, 264, 'Count: 1 API server + 1 engine core + 4 workers = 6 processes.', { size: 11.5, serif: true, hue: 'ink-soft' });
});
