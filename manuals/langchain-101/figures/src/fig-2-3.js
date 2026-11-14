'use strict';

const fs = require('fs');
const path = require('path');
const { figure } = require('../../../_shared/figkit.js');

const out = name => fs.readFileSync(path.join(__dirname, '../../capture/out', name), 'utf8');
const run = out('06-agent-run.txt');
const start = run.indexOf('\n[\n', run.indexOf('"messages"\n]')) + 1;
const final = JSON.parse(run.slice(start, run.indexOf('\n]\n', start) + 2));
const [, ask, answer, reply] = final;
const call = ask.tool_calls[0];
const usage = JSON.parse(/"usage_metadata": (\{[\s\S]*?\})/.exec(out('02-messages.txt'))[1]);
const show = value => (typeof value === 'string' ? JSON.stringify(value) : JSON.stringify(value).replace(/"/g, '').replace(/,/g, ', ').replace(/:/g, ': '));

module.exports = figure('fig-2-3', {
  height: 400,
  title: 'The fields of an AIMessage and its ToolMessage',
  desc: `Three cards read from one agent run. The first is the AIMessage that asks for a tool: content ${show(ask.content)}, id ${ask.id}, and tool_calls with name ${call.name}, args ${show(call.args)}, and id ${call.id}. The second is the ToolMessage that answers it: content ${show(answer.content)}, name ${answer.name}, tool_call_id ${answer.tool_call_id}, and status ${answer.status}. A dashed line joins the id ${call.id} in the tool call to tool_call_id ${answer.tool_call_id}. The third, below, is the final AIMessage with content ${show(reply.content)} and no tool_calls, which ends the loop. A reply from a real provider also carries usage_metadata, such as ${usage.input_tokens} input and ${usage.output_tokens} output tokens in the messages capture.`,
}, f => {
  const card = (x, y, w, h, hue, title, rows) => {
    f.rect(x, y, w, h, { hue });
    f.text(x + 14, y + 22, title, { size: 13, weight: 700, hue });
    return rows.map(([k, v, strong], i) => {
      const ry = y + 50 + i * 24;
      f.text(x + 14, ry, k, { size: 11.5, hue: 'ink-soft' });
      f.text(x + 128, ry, v, { size: 11.5, weight: strong ? 700 : undefined, hue: strong ? hue : undefined, max: w - 140 });
      return ry;
    });
  };
  f.beat(1);
  const left = card(20, 14, 280, 200, 'plum', 'AIMessage', [['content', show(ask.content)], ['id', ask.id], ['tool_calls', ''], ['  .name', call.name], ['  .args', show(call.args)], ['  .id', call.id, true]]);
  f.beat(2);
  const right = card(340, 14, 280, 200, 'green', answer.type, [['content', show(answer.content)], ['name', answer.name], ['id', answer.id], ['tool_call_id', answer.tool_call_id, true], ['status', answer.status]]);
  f.path(`M${128 + 20 + call.id.length * 6.9 + 6} ${left[5] - 4} L318 ${left[5] - 4} L318 ${right[3] - 4} L339 ${right[3] - 4}`, { style: 'reply' });
  f.text(318, left[5] + 14, 'same id', { size: 11, serif: true, anchor: 'middle', hue: 'ink-soft', knock: true });
  f.beat(3);
  f.arrow([400, 214], [400, 241], { style: 'model' });
  f.text(410, 232, 'the next model call reads both', { size: 11, serif: true, hue: 'plum' });
  card(20, 242, 600, 112, 'plum', `${reply.type}, the final answer`, [['content', show(reply.content)], ['tool_calls', 'none, so the agent stops'], ['usage', `${usage.input_tokens} in, ${usage.output_tokens} out, when the provider reports it`]]);
  f.beat(0);
  f.text(20, 376, 'The request for a tool is in tool_calls, already parsed, and its content is empty.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 392, 'The ToolMessage repeats the id of the call it answers.', { size: 11, serif: true, hue: 'ink-soft' });
});
