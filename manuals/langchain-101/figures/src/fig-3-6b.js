'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-3-6b', {
  height: 430,
  title: 'What AutoModeMiddleware does with one tool call',
  desc: 'The model asks for two tool calls, delete_branch with name main and add with 2 and 3. For each listed tool, AutoModeMiddleware asks the decision model the noul question is_risky, with the instructions, the tool call, the tool description, up to 30 messages, and criteria null. delete_branch scored 0.93, at or above 0.5, so it got an error ToolMessage and did not run. add scored 0.05, so it ran and returned 5. A tool that is not listed runs with no question.',
}, f => {
  const ai = f.box({ x: 320, y: 12, w: 300, h: 48, hue: 'plum', title: 'AIMessage tool_calls', sub: 'delete_branch(main), add(2, 3)', anchor: 'middle' });
  const q = f.box({ x: 120, y: 100, w: 400, h: 84, hue: 'amber', title: 'question is_risky, type noul', sub: ['instructions, tool_call, tool_description,', 'up to 30 messages, criteria: null'] });
  f.arrow([320, ai.y + ai.h], [320, q.y - 1], { style: 'call', label: 'each listed tool' });
  const block = f.box({ x: 20, y: 250, w: 280, h: 64, hue: 'rose', title: 'delete_branch: 0.93', sub: ['at or above 0.5: error ToolMessage,', 'the tool does not run'], align: 'left' });
  const run = f.box({ x: 340, y: 250, w: 280, h: 64, hue: 'green', title: 'add: 0.05', sub: ['below 0.5: the tool runs,', 'ToolMessage 5'], align: 'left' });
  f.path(`M220 ${q.y + q.h} V${block.y - 1}`, { style: 'fail' });
  f.path(`M420 ${q.y + q.h} V${run.y - 1}`, { style: 'reply' });
  f.text(228, 222, 'risky', { size: 11, hue: 'rose', knock: true });
  f.text(428, 222, 'allowed', { size: 11, knock: true });
  f.box({ x: 20, y: 344, w: 600, h: 48, hue: 'grey', title: 'a tool missing from tools=', sub: 'runs with no question to the decision model', align: 'left' });
  f.text(20, 418, 'The probabilities are the answers of a scripted decision model in the kit.', { size: 11, serif: true, hue: 'ink-soft' });
});
