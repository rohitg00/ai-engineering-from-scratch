'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('plate-sglang-request', {
  height: 420,
  title: 'One request, three processes, one cache',
  desc: 'A chat request with a 2,999-token prompt crosses the tokenizer manager, the scheduler, and the detokenizer. The scheduler finds 2,998 tokens in the radix cache, prefills one, and the first token arrives in 34.0 ms. Below, three versions of the same system prompt: unchanged, with a request id at the start, and with the id at the end, with their cached tokens and median time to first token.',
}, f => {
  f.kicker(20, 18, 'one request · round 3 of the stable system prompt');
  const client = f.box({ x: 20, y: 34, w: 100, h: 56, hue: 'olive', title: 'client', sub: ['2,999 tokens'] });
  const tok = f.box({ x: 140, y: 34, w: 160, h: 56, hue: 'blue', title: 'TokenizerManager', sub: ['text to ids'] });
  const sched = f.box({ x: 320, y: 34, w: 140, h: 56, hue: 'blue', title: 'Scheduler', sub: ['match_prefix'] });
  const detok = f.box({ x: 480, y: 34, w: 140, h: 56, hue: 'blue', title: 'Detokenizer', sub: ['ids to text'] });
  f.beat(1);
  f.arrow([client.x + 100, 62], [tok.x - 1, 62], { style: 'call' });
  f.beat(2);
  f.arrow([tok.x + 160, 62], [sched.x - 1, 62], { style: 'event' });
  f.beat(3);
  f.arrow([sched.x + 140, 62], [detok.x - 1, 62], { style: 'event' });

  f.beat(4);

  f.kicker(20, 124, 'the prompt as the radix cache saw it');
  f.rect(20, 134, 590, 30, { hue: 'green' });
  f.text(30, 154, '2,998 cached tokens · system prompt and chat template', { size: 12, weight: 700, hue: 'green' });
  f.beat(5);
  f.rect(610, 134, 10, 30, { hue: 'plum' });
  f.text(620, 184, '1 new token', { size: 11, anchor: 'end', hue: 'plum' });
  f.text(20, 184, 'first token after 34.0 ms', { size: 12, weight: 700, hue: 'plum' });

  f.beat(0);
  f.kicker(20, 226, 'the same system prompt three ways · median of rounds 2 to 5 or 1 to 5');
  const rows = [
    { hue: 'green', title: 'unchanged', cached: '2,998 of 2,999 cached', ttft: '45.1 ms' },
    { hue: 'rose', title: 'request id at the start', cached: '5 of 3,034 cached', ttft: '1,255.3 ms' },
    { hue: 'green', title: 'request id at the end', cached: '2,985 of 3,028 cached', ttft: '88.2 ms' },
  ];
  rows.forEach((row, index) => {
    const y = 238 + index * 56;
    f.beat(6 + index);
    f.box({ x: 20, y, w: 260, h: 44, hue: row.hue, title: row.title, align: 'left' });
    f.text(300, y + 27, row.cached, { size: 12, serif: true, hue: 'ink-soft' });
    f.text(620, y + 27, row.ttft, { size: 13, weight: 700, anchor: 'end', hue: row.hue === 'rose' ? 'rose' : 'plum' });
  });
  f.beat(0);
  f.text(20, 412, 'From capture/out/cache-experiment.txt · SGLang 0.5.22 on MLX · Qwen3-0.6B-4bit', { size: 11, serif: true, hue: 'ink-mute' });
});
