'use strict';

const { figure } = require('../../../_shared/figkit.js');

const lanes = [
  { x: 20, name: 'curl', hue: 'grey' },
  { x: 245, name: 'serve a2a :8082', hue: 'indigo' },
  { x: 470, name: 'DMR :12434', hue: 'plum' },
];
const cx = index => lanes[index].x + 75;
const rows = [
  [0, 1, 'call', 'GET /.well-known/agent-card.json', null],
  [1, 0, 'reply', 'card: /invoke, JSONRPC, 1.0', null],
  [0, 1, 'call', 'POST /invoke SendMessage', 'A2A-Version: 1.0, ROLE_USER, ping'],
  [1, 2, 'model', 'chat completion, ai/qwen3:4b', null],
  [2, 1, 'reply', 'pong', null],
  null,
  [1, 0, 'reply', 'result.task, artifact text pong', null],
  [0, 1, 'call', 'POST /invoke GetTask, id <uuid>', null],
  [1, 0, 'reply', 'the same task, with history', null],
];
const top = 76;
const gap = 44;
const height = top + rows.length * gap;

module.exports = figure('fig-6-3', {
  height,
  title: 'One A2A card, one SendMessage, one GetTask',
  desc: 'Three lifelines: curl on the host, docker-agent serve a2a on 127.0.0.1:8082 serving pong.yaml, and Docker Model Runner on localhost:12434. curl reads the agent card at /.well-known/agent-card.json, which names one JSON-RPC interface at /invoke with protocol version 1.0. curl posts SendMessage with A2A-Version 1.0 and a ROLE_USER message ping. The server makes one live chat completion on ai/qwen3:4b, which answers pong, moves the task to TASK_STATE_COMPLETED, and returns result.task with the answer in an artifact. GetTask with the task id returns the same task with its history.',
}, f => {
  for (const lane of lanes) {
    f.box({ x: lane.x, y: 10, w: 150, h: 30, hue: lane.hue, title: lane.name, titleSize: 11 });
    f.lifeline(lane.x + 75, 40, height - 8);
  }
  rows.forEach((row, index) => {
    const y = top + index * gap;
    f.beat(index + 1);
    if (!row) {
      f.step(24, y, index + 1, { hue: 'amber' });
      f.box({ x: cx(1), y: y - 13, w: 190, h: 26, anchor: 'middle', hue: 'amber', title: 'TASK_STATE_COMPLETED', titleSize: 11 });
      return;
    }
    const [from, to, style, label, note] = row;
    f.step(24, y, index + 1);
    const x1 = cx(from);
    const x2 = cx(to);
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label, note });
  });
});
