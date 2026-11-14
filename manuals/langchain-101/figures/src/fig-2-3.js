'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-2-3', {
  height: 300,
  title: 'The fields of an AIMessage and its ToolMessage',
  desc: 'Two cards side by side. The left card is the AIMessage that asks for a tool: type AIMessage, content an empty string, id lc_run--<uuid>-0, and tool_calls with name add, args a 2 and b 3, and id call_1. The right card is the ToolMessage that answers it: content 5, name add, tool_call_id call_1, and status success. A line joins the id call_1 in the tool call to tool_call_id call_1 in the ToolMessage.',
}, f => {
  const card = (x, hue, title, rows) => {
    f.rect(x, 20, 280, 230, { hue });
    f.text(x + 14, 44, title, { size: 13, weight: 700, hue });
    rows.forEach(([k, v, strong], i) => {
      const y = 76 + i * 26;
      f.text(x + 14, y, k, { size: 11.5, hue: 'ink-soft' });
      f.text(x + 130, y, v, { size: 11.5, weight: strong ? 700 : undefined, hue: strong ? hue : undefined });
    });
  };
  card(20, 'plum', 'AIMessage', [['content', '""'], ['id', 'lc_run--<uuid>-0'], ['tool_calls', ''], ['  .name', 'add'], ['  .args', '{a: 2, b: 3}'], ['  .id', 'call_1', true], ['usage', 'when reported']]);
  card(340, 'green', 'ToolMessage', [['content', '"5"'], ['name', 'add'], ['id', '<uuid>'], ['tool_call_id', 'call_1', true], ['status', 'success']]);
  f.path('M198 202 L270 202 L270 150 L339 150', { style: 'reply' });
  f.text(20, 276, 'The request for a tool is in tool_calls, already parsed. The content is empty.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 294, 'The ToolMessage repeats the id of the call it answers.', { size: 11, serif: true, hue: 'ink-soft' });
});
