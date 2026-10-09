'use strict';

const { figure } = require('../../../_shared/figkit.js');

const lanes = [
  { x: 20, name: 'curl', hue: 'grey' },
  { x: 175, name: 'serve api :8080', hue: 'indigo' },
  { x: 330, name: 'api-session.db', hue: 'teal' },
  { x: 485, name: 'cassette 23-api', hue: 'plum' },
];
const cx = index => lanes[index].x + 65;
const rows = [
  [0, 1, 'call', 'GET /api/agents', null],
  [1, 0, 'reply', 'name: pong, multi: false', null],
  [0, 1, 'call', 'POST /api/sessions {}', null],
  [1, 2, 'write', 'session <uuid>', null],
  [1, 0, 'reply', '200, id <uuid>', 'tools_approved: false'],
  [0, 1, 'call', 'POST /api/sessions/<uuid>/agent/pong', 'messages: user ping'],
  [1, 0, 'event', 'team_info, toolset_info, user_message', null],
  [1, 0, 'event', 'stream_started', null],
  [1, 3, 'model', 'chat completion, dmr/ai/qwen3:4b', '--fake replays the recorded answer'],
  [3, 1, 'reply', 'pong, finish_reason stop', null],
  [1, 0, 'event', 'agent_choice: pong', null],
  [1, 0, 'event', 'message_added, token_usage', null],
  [1, 0, 'event', 'stream_stopped, reason normal', null],
  [0, 1, 'call', 'GET /api/sessions/<uuid>', null],
  [1, 0, 'reply', 'messages: ping, pong', 'with reasoning_content'],
];
const top = 76;
const gap = 42;
const height = top + rows.length * gap + 4;

module.exports = figure('fig-6-1', {
  height,
  title: 'One serve api session and one streamed run',
  desc: 'Four lifelines: curl on the host, docker-agent serve api on 127.0.0.1:8080 serving pong.yaml, the session database work/api-session.db, and the cassette 23-api that --fake replays in place of ai/qwen3:4b. curl lists the agents and gets pong, creates a session with an empty body, and posts the message ping to /api/sessions/<uuid>/agent/pong with Accept text/event-stream. The server streams team_info, toolset_info, user_message, and stream_started, makes one chat completion that the cassette answers with pong, then streams agent_choice, message_added, token_usage, and stream_stopped. A last GET reads the stored session with both messages.',
}, f => {
  for (const lane of lanes) {
    f.box({ x: lane.x, y: 10, w: 130, h: 30, hue: lane.hue, title: lane.name, titleSize: 11 });
    f.lifeline(lane.x + 65, 40, height - 8);
  }
  rows.forEach(([from, to, style, label, note], index) => {
    const y = top + index * gap;
    f.beat(index + 1);
    f.step(24, y, index + 1);
    const x1 = cx(from);
    const x2 = cx(to);
    const labelX = from === 0 || to === 0 ? 180 : (x1 + x2) / 2;
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label, note, labelX });
  });
});
