'use strict';

const { figure } = require('../../../_shared/figkit.js');

const groups = [
  { label: 'the server does not start', hue: 'rose', rows: [
    ['download hangs', 'cache folder size', 'hf download'],
    ['model not supported', 'architecture in error', 'supported list'],
    ['driver or PTX error', 'error text', 'update driver'],
    ['KV cache and max length', 'length in error', '2.2'],
    ['free memory below share', 'nvidia-smi', '2.2'],
    ['crash with FP8 KV cache', 'backend line', '2.4'],
    ['DGX Spark out of memory', 'free -g', '2.3'],
    ['slow first start, GB10', 'Model loading took', '2.3'],
    ['compile step fails', 'torch.compile error', 'clear cache'],
    ['multi-GPU start hangs', 'NCCL_DEBUG=TRACE', '6.1'],
    ['shorter max length', 'derived length', '2.6'],
  ] },
  { label: 'requests fail', hue: 'rose', rows: [
    ['HTTP 400, context length', 'counts in error', 'shorter request'],
    ['every request fails', 'EngineCore error', 'restart'],
  ] },
  { label: 'the server is slow', hue: 'amber', rows: [
    ['first token takes seconds', 'waiting, KV usage', '3.1'],
    ['long gaps, many users', 'P99 against median', '3.3'],
    ['preemptions rise', 'num_preemptions', '3.1'],
    ['n-gram gives less', 'async warning', '4.2'],
    ['eager start slow', 'first requests', '4.3'],
    ['NVFP4 slow on GB10', 'TPOT against 0.28', 'pin release'],
  ] },
  { label: 'the output is wrong', hue: 'violet', rows: [
    ['answer starts with think', 'content field', '3.10'],
    ['one token repeated', 'cache hit, spec', 'turn one off'],
    ['invalid JSON with spec', 'run without spec', '3.5'],
    ['output changes per run', 'same request alone', '3.8'],
  ] },
  { label: 'the benchmark is wrong', hue: 'olive', rows: [
    ['second run faster', 'prefix cache hits', '5.1'],
  ] },
];

const ROW = 21;
const HEAD = 22;
const count = groups.reduce((n, g) => n + g.rows.length, 0);
const height = 34 + groups.length * HEAD + count * ROW + 6;

module.exports = figure('fig-7-1', {
  height,
  title: 'Each troubleshooting entry: the symptom, the first check, and where the fix is',
  desc: 'Twenty-four symptoms in five groups: the server does not start, requests fail, the server is slow, the output is wrong, and the benchmark is wrong. Each row gives the first log line or metric to check and the section or action that fixes it.',
}, f => {
  f.kicker(20, 18, 'what you see');
  f.kicker(300, 18, 'check first');
  f.kicker(500, 18, 'then');
  let y = 30;
  for (const group of groups) {
    f.rect(20, y + 3, 600, HEAD - 6, { hue: group.hue });
    f.text(28, y + 15, group.label, { size: 11, weight: 700, max: 580 });
    y += HEAD;
    for (const [symptom, check, then] of group.rows) {
      f.text(28, y + 14, symptom, { size: 11, max: 264 });
      f.text(300, y + 14, check, { size: 11, serif: true, hue: 'ink-soft', max: 190 });
      f.text(500, y + 14, then, { size: 11, hue: 'blue', max: 118 });
      f.rule(20, y + ROW, 620, y + ROW, { hue: 'grey' });
      y += ROW;
    }
  }
});
