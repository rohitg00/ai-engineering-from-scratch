'use strict';

const { figure } = require('../../../_shared/figkit.js');

const lanes = [
  { x: 130, title: 'client', sub: 'generated stub', hue: 'violet' },
  { x: 500, title: 'A2AService', sub: 'lf.a2a.v1', hue: 'blue' },
];

const rows = [
  [0, 1, 'call', 'SendStreamingMessage(SendMessageRequest)', 'metadata: a2a-version, a2a-extensions'],
  [1, 0, 'event', 'StreamResponse { task }', 'the Task as the server created it'],
  [1, 0, 'event', 'StreamResponse { status_update }', 'TaskStatusUpdateEvent'],
  [1, 0, 'event', 'StreamResponse { artifact_update }', 'TaskArtifactUpdateEvent, one chunk'],
  [1, 0, 'event', 'StreamResponse { status_update }', 'a terminal TaskState'],
  [1, 0, 'reply', 'rpc status', 'the stream ends with the rpc'],
];

module.exports = figure('fig-grpc-call', {
  height: 352,
  title: 'One SendStreamingMessage call over gRPC',
  desc: 'A sequence with two lifelines, a client stub and the A2AService in package lf.a2a.v1. The client sends one SendStreamingMessage rpc with a SendMessageRequest and the a2a-version and a2a-extensions metadata keys. The server answers with a stream of StreamResponse messages: first the task, then status_update and artifact_update payloads, then a status_update with a terminal state. The rpc status ends the stream. The figure uses proto names only, because the kit has no gRPC capture.',
}, f => {
  for (const lane of lanes) {
    f.box({ x: lane.x, y: 8, w: 150, h: 38, hue: lane.hue, title: lane.title, sub: lane.sub, anchor: 'middle' });
    f.lifeline(lane.x, 46, 340);
  }
  rows.forEach(([from, to, style, label, note], index) => {
    const y = 84 + index * 48;
    f.beat(index + 1);
    f.step(24, y, index + 1);
    const x1 = lanes[from].x;
    const x2 = lanes[to].x;
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label, note, labelX: (x1 + x2) / 2 });
  });
});
