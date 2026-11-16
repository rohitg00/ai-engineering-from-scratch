'use strict';

const fs = require('fs');
const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { flat } = require('../../../_shared/forms.js');

const lab = path.join(__dirname, '../../capture/lab/chat-ui-mac');
const summary = JSON.parse(fs.readFileSync(path.join(lab, 'summary/chatui-mac.json'), 'utf8'));
const seq = summary.requests_after_isolated_browser;
const byN = n => seq.find(r => r.n === n);
const sseEvents = n => fs.readFileSync(path.join(lab, 'runs/sse', `${String(n).padStart(4, '0')}.sse`), 'utf8')
  .replace(/\r\n/g, '\n').split('\n\n')
  .map(block => (block.split('\n').find(l => l.startsWith('event:')) || '').slice(6).trim())
  .filter(Boolean);

const info = byN(9);
const search = byN(10);
const create = byN(14);
const ask = byN(20);
const askHistory = byN(21);
const resume = byN(22);
const resumeHistory = byN(23);
const askEvents = sseEvents(20);
const resumeEvents = sseEvents(22);
const count = (list, name) => list.filter(e => e === name).length;
const s = v => `${v.toFixed(2)} s`;
const tool = summary.tool_runs.find(t => t.name === 'send_email');

const lanes = [
  { title: 'Agent Chat UI', sub: 'browser', hue: 'violet', draw: (f, x) => flat.terminal(f, x, 18, 'violet', { w: 40, h: 34 }) },
  { title: 'Agent Server', sub: 'langgraph dev', hue: 'indigo', draw: (f, x) => flat.unit(f, x, 22, 'indigo', { w: 34, h: 30 }) },
  { title: 'agent graph', sub: 'create_agent, Ollama', hue: 'plum', draw: (f, x) => flat.tower(f, x, 18, 'plum', { w: 34, h: 34 }) },
];
const cx = [70, 340, 540];

const groups = [
  { hue: 'ink', rows: [
    [0, 1, 'call', `GET /info  ${info.status}`, 'on load and after each connect'],
    [0, 1, 'call', `POST /threads/search  graph_id ${search.body_shape.metadata.graph_id}`, `limit ${search.body_shape.limit}, fills the history list`],
    [0, 1, 'call', 'POST /threads  metadata {}', 'first message of a thread only'],
  ] },
  { hue: 'ink', rows: [
    [0, 1, 'call', 'POST runs/stream  input.messages', `${ask.body_shape.stream_mode.join(', ')}; on_disconnect ${ask.body_shape.on_disconnect}`],
    [1, 2, 'call', 'run', 'model call'],
    [2, 1, 'reply', 'AI message, whole tool call', `${s(ask.timing.server_first_model_output_s)} after the POST`],
    [1, 0, 'event', `messages: ${ask.timing.sse_first_ai_value}`, `tool card painted ${s(ask.timing.ui_minus_sse_s)} later`],
    [1, 0, 'state', 'values: __interrupt__', `${count(askEvents, 'values')} values and ${count(askEvents, 'messages')} messages events in all`],
    [0, 1, 'call', `POST /history  limit ${askHistory.body_shape.limit}`, 'after every run'],
  ] },
  { hue: 'teal', rows: [
    [0, 1, 'call', 'POST runs/stream  command.resume', `decisions [${resume.body_shape['command.resume'].decisions.map(d => d.type).join(', ')}]; on_disconnect ${resume.body_shape.on_disconnect}`],
    [1, 2, 'call', 'resume from checkpoint', `stream_resumable ${resume.body_shape.stream_resumable}`],
    [2, 2, 'effect', `${tool.name} runs`, ''],
    [1, 0, 'event', `messages: "${resume.timing.sse_first_ai_value}", ${count(resumeEvents, 'messages')} events in all`, `first token ${s(resume.timing.sse_first_ai_event_s)}, painted ${s(resume.timing.ui_minus_sse_s)} later`],
    [0, 1, 'call', `POST /history  limit ${resumeHistory.body_shape.limit}`, ''],
  ] },
];

const HEIGHT = 112 + groups.reduce((sum, g) => sum + g.rows.length * 40 + 10, 0) + 30;

module.exports = figure('fig-8-2', {
  height: HEIGHT,
  title: 'The requests of Agent Chat UI for one approval',
  desc: `Three lifelines: the Agent Chat UI in the browser, Agent Server under langgraph dev, and the agent graph on Ollama. Step 1, on load the UI calls GET /info and POST /threads/search with graph_id ${search.body_shape.metadata.graph_id} and limit ${search.body_shape.limit}, and the first message of a thread calls POST /threads. Step 2, the message is POST runs/stream with stream modes ${ask.body_shape.stream_mode.join(', ')} and on_disconnect ${ask.body_shape.on_disconnect}. The model returns the whole ${ask.timing.sse_first_ai_value} call ${s(ask.timing.server_first_model_output_s)} after the POST, a messages event carries it, and a values event carries __interrupt__. The UI then calls POST /history. Step 3, Approve sends POST runs/stream with command.resume decisions ${resume.body_shape['command.resume'].decisions.map(d => d.type).join(', ')}, on_disconnect ${resume.body_shape.on_disconnect}, and stream_resumable ${resume.body_shape.stream_resumable}. The tool runs, the first token arrives ${s(resume.timing.sse_first_ai_event_s)} after the POST, and the UI paints it ${s(resume.timing.ui_minus_sse_s)} later.`,
}, f => {
  lanes.forEach((lane, index) => {
    lane.draw(f, cx[index]);
    f.text(cx[index], 70, lane.title, { size: 11, weight: 700, hue: lane.hue, anchor: 'middle' });
    f.text(cx[index], 84, lane.sub, { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });
    f.lifeline(cx[index], 92, HEIGHT - 24);
  });
  let y = 116;
  groups.forEach((group, g) => {
    const top = y;
    f.beat(g + 1);
    group.rows.forEach(([from, to, style, label, note]) => {
      const x1 = cx[from];
      const x2 = cx[to];
      if (from === to) {
        f.rect(x2 - 6, y - 10, 12, 20, { hue: 'olive' });
        f.text(x2 - 14, y + 4, label, { size: 11.5, hue: 'olive', anchor: 'end', knock: true });
      } else {
        f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label, note: note || undefined });
      }
      y += 40;
    });
    f.step(16, top, g + 1, { hue: group.hue });
    if (group.rows.length > 1) f.rule(16, top + 10, 16, y - 46, { hue: 'ink-mute' });
    y += 10;
  });
  f.beat(0);
});
