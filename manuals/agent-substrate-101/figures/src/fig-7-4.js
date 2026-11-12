'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-7-4', {
  height: 366,
  title: 'Five questions that decide if Agent Substrate fits',
  desc: 'Five questions in a column. A no on any question leads right to a simpler choice: a pod on a GPU node, a plain pod per agent, a new sandbox per session, a hosted sandbox, or a harness that must come first. Five yes answers lead to Agent Substrate.',
}, f => {
  const questions = [
    ['1 · the agent runs on CPU only?', 'a pod per agent, on a GPU node'],
    ['2 · the agent is idle most of the time?', 'a plain pod per agent'],
    ['3 · state must outlive the idle time?', 'a new sandbox for each session'],
    ['4 · you can operate Postgres?', 'a hosted sandbox'],
    ['5 · something calls SuspendActor?', 'add a harness first, such as kagent'],
  ];
  questions.forEach(([question, outcome], index) => {
    const y = 20 + index * 58;
    f.box({ x: 20, y, w: 310, h: 34, hue: 'amber', title: question, titleSize: 11.5 });
    f.arrow([330, y + 17], [382, y + 17], { style: 'fail', label: 'no', labelX: 356 });
    f.text(390, y + 21, outcome, { size: 11, serif: true, hue: 'rose' });
    if (index < questions.length - 1) f.arrow([175, y + 34], [175, y + 57], { style: 'call' });
  });
  const y = 20 + questions.length * 58;
  f.arrow([175, y - 24], [175, y + 1], { style: 'call', label: 'yes' });
  f.box({ x: 20, y: y + 2, w: 310, h: 40, hue: 'green', title: 'Agent Substrate', sub: 'many stateful actors on few worker pods', titleSize: 12 });
});
