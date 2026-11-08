'use strict';

const { figure } = require('../../../_shared/figkit.js');

const LEFT = { x: 20, w: 300 };
const RIGHT = { x: 350, w: 270 };
const H = 46;
const ROWS = [30, 100, 170, 240, 310, 380, 450, 520, 590];
const MID = LEFT.x + LEFT.w / 2;

function stage(f, row, options) {
  return f.box({ x: LEFT.x, y: ROWS[row], w: LEFT.w, h: H, titleSize: 12, ...options });
}

function side(f, row, options) {
  return f.box({ x: RIGHT.x, y: ROWS[row], w: RIGHT.w, h: H, titleSize: 12, ...options });
}

function down(f, from, to, label) {
  f.arrow([MID, from.y + from.h], [MID, to - 1], { style: 'call', label });
}

function fail(f, row) {
  f.arrow([LEFT.x + LEFT.w, ROWS[row] + H / 2], [RIGHT.x - 1, ROWS[row] + H / 2], { style: 'fail' });
}

module.exports = figure('fig-server-parts', {
  height: 656,
  title: 'The parts of a server, in the order a request meets them',
  desc: 'One SendStreamingMessage request enters the kit server at Handler.jsonrpc or Handler.rest. It passes authenticate, which answers HTTP 401 for a bad token, check_version, which answers VersionNotSupportedError -32009, and the capability check on the card, which answers UnsupportedOperationError -32004. Agent.send then validates the message and stores a task in Agent.tasks as TASK_STATE_SUBMITTED. Agent.work runs the behavior, the agent logic, in a thread. Agent.apply writes each event to the task record and Agent.broadcast copies it to every subscriber queue, which Handler.pump writes as SSE data frames, and to Agent.deliver, which POSTs it to each webhook URL.',
}, f => {
  f.kicker(LEFT.x, 18, 'the request, top to bottom');
  f.kicker(RIGHT.x, 18, 'what a failed check returns');

  f.beat(1);
  const request = stage(f, 0, { hue: 'violet', title: 'SendStreamingMessage request', sub: 'POST /a2a/jsonrpc, A2A-Version: 1.0' });
  const handler = stage(f, 1, { hue: 'blue', title: 'Handler.jsonrpc, Handler.rest', sub: 'one method per binding, same checks' });
  down(f, request, ROWS[1]);

  f.beat(2);
  const auth = stage(f, 2, { hue: 'blue', title: 'authenticate', sub: 'bearer token, deployer only' });
  down(f, handler, ROWS[2]);
  side(f, 2, { hue: 'rose', dash: 'dashed', title: 'HTTP 401', sub: 'WWW-Authenticate: Bearer' });
  fail(f, 2);

  f.beat(3);
  const version = stage(f, 3, { hue: 'blue', title: 'check_version', sub: 'A2A-Version must be 1.0' });
  down(f, auth, ROWS[3]);
  side(f, 3, { hue: 'rose', dash: 'dashed', title: 'VersionNotSupportedError', sub: '-32009, FAILED_PRECONDITION' });
  fail(f, 3);

  f.beat(4);
  const capability = stage(f, 4, { hue: 'blue', title: 'card["capabilities"]', sub: 'streaming, pushNotifications' });
  down(f, version, ROWS[4]);
  side(f, 4, { hue: 'rose', dash: 'dashed', title: 'UnsupportedOperationError', sub: '-32004, or -32003 for push' });
  fail(f, 4);

  f.beat(5);
  const send = stage(f, 5, { hue: 'blue', title: 'Agent.send', sub: 'validate_message, then one task' });
  down(f, capability, ROWS[5]);
  const store = side(f, 5, { hue: 'teal', title: 'Agent.tasks', sub: 'the task record, TASK_STATE_SUBMITTED' });
  f.arrow([send.x + send.w, send.cy], [store.x - 1, store.cy], { style: 'write' });

  f.beat(6);
  const work = stage(f, 6, { hue: 'plum', title: 'Agent.work, behavior', sub: 'the agent logic, in its own thread' });
  down(f, send, ROWS[6], 'a thread per request');

  f.beat(7);
  const apply = stage(f, 7, { hue: 'indigo', title: 'Agent.apply, Agent.broadcast', sub: 'the record, then every subscriber' });
  down(f, work, ROWS[7], 'yields events');
  f.path(`M${apply.x + apply.w} ${apply.cy} H335 V${store.cy + 10} H${store.x - 1}`, { style: 'write' });
  f.text(346, apply.cy - 6, 'writes the task', { size: 11, serif: true, hue: 'ink-soft', knock: true });

  f.beat(8);
  const pump = stage(f, 8, { hue: 'indigo', title: 'Handler.pump', sub: 'data: frames on each SSE stream' });
  const deliver = side(f, 8, { hue: 'indigo', title: 'Agent.deliver', sub: 'POST to each webhook URL' });
  f.arrow([MID, apply.y + apply.h], [MID, pump.y - 1], { style: 'event', label: 'each event' });
  f.path(`M${apply.x + 250} ${apply.y + apply.h} V578 H${deliver.cx} V${deliver.y - 1}`, { style: 'event' });
  f.text(deliver.cx - 100, 574, 'each event', { size: 11.5, hue: 'indigo', knock: true });
});
