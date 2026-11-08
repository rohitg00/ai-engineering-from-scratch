'use strict';

const { figure } = require('../../../_shared/figkit.js');

const rows = [
  ['version', '0.31.0', 'the release that runs'],
  ['Using V2 Model Runner', 'V2', 'which model runner runs'],
  ['attention backend', 'FLASH_ATTN', 'which kernels run attention'],
  ['Model loading took', '56.93 GiB, 330 s', 'memory the weights hold'],
  ['Available KV cache memory', '31.32 GiB', 'memory left for the KV cache'],
  ['GPU KV cache size', '234,960 tokens', 'how many users fit'],
];

module.exports = figure('fig-1-2', {
  height: 346,
  title: 'The six startup lines to read after every start',
  desc: 'Six lines from the startup log of vLLM 0.31.0 on a DGX Spark with Qwen3-30B-A3B: version 0.31.0, the V2 model runner, the FLASH_ATTN attention backend, 56.93 GiB of weights loaded in 330 seconds, 31.32 GiB left for the KV cache, and a pool of 234,960 tokens.',
}, f => {
  f.kicker(20, 18, 'log line');
  f.kicker(250, 18, 'our value');
  f.kicker(410, 18, 'what it decides');
  rows.forEach(([line, value, decides], index) => {
    const y = 30 + index * 50;
    f.box({ x: 20, y, w: 218, h: 38, hue: 'blue', title: line, titleSize: 11.5, align: 'left' });
    f.text(250, y + 24, value, { size: 12, weight: 700, hue: index === 5 ? 'green' : 'ink' });
    f.text(410, y + 24, decides, { size: 11.5, serif: true, hue: 'ink-soft' });
  });
  f.text(20, 338, 'Find each line once after every start, before you send traffic.', { size: 11, serif: true, hue: 'ink-soft' });
});
