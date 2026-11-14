'use strict';

const fs = require('fs');
const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');

const run = fs.readFileSync(path.join(__dirname, '../../capture/out/06-agent-run.txt'), 'utf8');
const after = heading => run.slice(run.indexOf(heading) + heading.length);
const callText = after('model calls seen by the fake:');
const calls = JSON.parse(callText.slice(0, callText.lastIndexOf(']') + 1));
const finalText = after('## final state');
const start = finalText.indexOf('\n[\n', finalText.indexOf('"messages"\n]')) + 1;
const final = JSON.parse(finalText.slice(start, finalText.indexOf('\n]\n', start) + 2));
const system = calls[0].messages[0];
if (!system.startsWith('system: ')) throw new Error('fig-2-5: the first message of a call is not the system prompt');
const short = message => {
  if (message.type === 'HumanMessage') return `human: ${message.content}`;
  if (message.type === 'ToolMessage') return `tool: ${message.content}`;
  if (message.tool_calls) return `ai: tool_calls ${message.tool_calls[0].name}`;
  return `ai: ${message.content}`;
};
const replies = final.filter(message => message.type === 'AIMessage');

const ROW = 150;
const line = (f, x, y, w, content, hue, options = {}) => {
  f.rect(x, y, w, 20, { fill: color(options.fresh ? `${hue}-fill` : 'paper'), stroke: color(`${hue}-ink`), dash: options.dash, strokeWidth: options.fresh ? 1.4 : 1 });
  f.text(x + 8, y + 14, content, { size: 11, hue: options.fresh ? hue : 'ink', weight: options.fresh ? 700 : undefined, max: w - 12 });
};

module.exports = figure('fig-2-5', {
  height: 400,
  title: 'How the model node builds each request',
  desc: `Two rows, one for each model call of the run in 06-agent-run.txt. On the left of each row is state.messages before the call, in teal: ${calls[0].messages.length - 1} message before call 1 and ${calls[1].messages.length - 1} before call 2. In the middle is the request the chat model received: the violet system prompt "${system.slice(8)}" first, dashed because it is not in the state, then the same messages from the state. A plum arrow carries the request to the chat model. A teal arrow carries the reply back, and the model node appends it to state.messages: a tool call to ${replies[0].tool_calls[0].name} after call 1, and "${replies[1].content}" after call 2. Between the rows the tools node appends the ToolMessage. The state ends with ${final.length} messages and no system message.`,
}, f => {
  f.kicker(20, 18, 'state.messages');
  f.kicker(236, 18, 'the request');
  f.kicker(510, 18, 'chat model');

  const states = [final.slice(0, calls[0].messages.length - 1), final.slice(0, calls[1].messages.length - 1)];
  states.forEach((state, r) => {
    const top = 34 + r * ROW;
    f.beat(r * 2 + 1);
    f.step(10, top + 10, r + 1, { hue: 'plum' });
    f.rect(20, top - 4, 196, state.length * 24 + 12, { hue: 'teal' });
    state.forEach((message, k) => line(f, 28, top + 2 + k * 24, 180, short(message), 'teal'));

    const request = calls[r].messages;
    f.rect(236, top - 4, 200, request.length * 24 + 12, { stroke: color('plum-ink'), fill: 'none' });
    line(f, 244, top + 2, 184, system, 'violet', { dash: 'dashed', fresh: true });
    state.forEach((message, k) => line(f, 244, top + 26 + k * 24, 184, short(message), 'teal'));
    f.arrow([216, top + 14 + 24], [235, top + 14 + 24], { style: 'call' });

    const model = f.box({ x: 510, y: top - 4, w: 110, h: 44, hue: 'plum', title: `call ${calls[r].call}`, sub: `tools: ${calls[r].bound.tools.join(', ')}`, titleSize: 11.5 });
    f.arrow([436, top + 16], [model.x - 1, top + 16], { style: 'model', label: `${request.length} messages`, labelX: 473 });

    f.beat(r * 2 + 2);
    const reply = replies[r];
    const y = top + Math.max(state.length * 24 + 12, request.length * 24 + 12) + 14;
    f.path(`M565 ${top + 40} V${y} H${20 + 196 + 1}`, { style: 'write' });
    f.text(340, y - 6, `appended: ${short(reply)}`, { size: 11.5, hue: 'teal', anchor: 'middle', knock: true });
    line(f, 28, y - 10, 180, short(reply), 'plum', { fresh: true });
  });

  f.beat(5);
  const end = 34 + 2 * ROW + 6;
  f.text(20, end + 10, `then the tools node appends "${short(final[2])}", and call 2 sees it.`, { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, end + 28, `After the run state.messages holds ${final.length} messages. The system prompt is not one of them.`, { size: 11, serif: true, hue: 'ink-soft' });
  f.rect(20, end + 40, 14, 12, { fill: color('violet-fill'), stroke: color('violet-ink'), dash: 'dashed' });
  f.text(40, end + 50, 'the system_prompt of create_agent: sent first on every call, never saved', { size: 11, serif: true, hue: 'ink-soft' });
});
