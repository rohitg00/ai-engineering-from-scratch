'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-5-3b', {
  height: 306,
  title: 'Six findings and the mechanism behind each',
  desc: 'Six rows from the independent field reports. Each row names a workload, the result that was reported, and the SGLang mechanism that explains it: kernels, the radix cache, chunked prefill, the decode graph limit, attention data and expert parallelism, and the cost of draft tokens.',
}, f => {
  f.kicker(20, 18, 'workload');
  f.kicker(222, 18, 'reported result');
  f.kicker(440, 18, 'mechanism');
  const rows = [
    ['unique prompts, dense', 'tie within a few percent', 'same kernel families', 'violet', false],
    ['repeated prefixes', 'first token 583 vs 2,141 ms', 'radix cache', 'green', false],
    ['16k-token prompts', 'slower first token, faster TPOT', 'chunked prefill 8,192', 'blue', false],
    ['no concurrency cap', 'ITL 100.92 vs 28.84 ms', 'graph limit, a guess', 'violet', true],
    ['DeepSeek MoE, many GPUs', 'reference engine, audited MLPerf', 'attention DP and EP', 'blue', false],
    ['MTP on a B200', 'TPOT 18.43 to 9.92 ms', 'draft cost, acceptance', 'plum', false],
  ];
  rows.forEach(([workload, result, mechanism, hue, guess], index) => {
    const y = 30 + index * 44;
    f.box({ x: 20, y, w: 190, h: 34, hue: 'olive', title: workload, titleSize: 11.5 });
    f.text(222, y + 22, result, { size: 11, serif: true, hue: 'ink-soft' });
    f.box({ x: 440, y, w: 180, h: 34, hue, title: mechanism, titleSize: 11.5, dash: guess ? 'dashed' : undefined });
  });
  f.text(20, 300, 'A dashed border marks our hypothesis, not a finding of the report.', { size: 11, serif: true, hue: 'ink-soft' });
});
