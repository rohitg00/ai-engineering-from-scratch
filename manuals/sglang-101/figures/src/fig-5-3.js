'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-5-3', {
  height: 420,
  title: 'Six questions to ask a published SGLang benchmark',
  desc: 'Six questions in a column: version stated, workload matches yours, memory budgets matched, concurrency under the graph limit, flags mapped across engines, and who paid. A no on any question leads right to what the result can still tell you. Six yes answers lead to testing the mechanism on your own server.',
}, f => {
  const questions = [
    ['1 · SGLang version stated?', 'an unknown build: anecdote only'],
    ['2 · workload matches yours?', 'describes another workload'],
    ['3 · memory budgets matched?', 'compares two KV pool sizes'],
    ['4 · concurrency under graph limit?', 'measured eager decode'],
    ['5 · flags mapped across engines?', 'a flag error can decide it'],
    ['6 · who paid is stated?', "read it as that party's claim"],
  ];
  questions.forEach(([question, outcome], index) => {
    const y = 20 + index * 58;
    f.box({ x: 20, y, w: 300, h: 34, hue: 'amber', title: question, titleSize: 12 });
    f.arrow([320, y + 17], [372, y + 17], { style: 'fail', label: 'no', labelX: 346 });
    f.text(380, y + 21, outcome, { size: 11, serif: true, hue: 'rose' });
    if (index < questions.length - 1) f.arrow([170, y + 34], [170, y + 57], { style: 'call' });
  });
  const y = 20 + questions.length * 58;
  f.arrow([170, y - 24], [170, y + 1], { style: 'call', label: 'yes' });
  f.box({ x: 20, y: y + 2, w: 300, h: 40, hue: 'olive', title: 'test the mechanism on your server', titleSize: 12 });
});
