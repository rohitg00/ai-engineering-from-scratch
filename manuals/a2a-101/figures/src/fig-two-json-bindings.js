'use strict';

const { figure, measure } = require('../../../_shared/figkit.js');

const LINE = 15;
const SIZE = 11;
const COLUMNS = [20, 334];
const WIDTH = 286;

function panel(f, x, y, w, h, hue, lines) {
  f.rect(x, y, w, h, { hue });
  lines.forEach((line, index) => {
    const baseline = y + 18 + index * LINE;
    let cursor = x + 12 + (line.indent || 0) * SIZE * 0.6;
    for (const piece of line.pieces) {
      f.text(cursor, baseline, piece.text, { size: SIZE, weight: piece.bold ? 700 : undefined, italic: piece.italic, serif: piece.serif, hue: piece.hue });
      cursor += measure(piece.text, SIZE, piece.serif);
    }
  });
  return { x, y, w, h, cx: x + w / 2, bottom: y + h };
}

const heightOf = count => count * LINE + 14;
const code = (text, extra = {}) => ({ pieces: [{ text }], ...extra });
const bold = text => ({ pieces: [{ text, bold: true }] });
const typed = (key, type) => ({ pieces: [{ text: key }, { text: type, italic: true, hue: 'ink-soft' }] });
const note = text => ({ pieces: [{ text, serif: true, hue: 'ink-soft' }] });

const ROWS = [
  {
    rpc: 'rpc SendMessage(SendMessageRequest) returns (SendMessageResponse)',
    left: [code('POST /a2a/jsonrpc'), code('Content-Type: application/json'), code('"jsonrpc": "2.0", "id": 1,'), bold('"method": "SendMessage",'), typed('"params": ', 'SendMessageRequest')],
    right: [bold('POST /a2a/rest/message:send'), code('Content-Type: application/a2a+json'), typed('body: ', 'SendMessageRequest')],
    leftReply: [code('HTTP/1.1 200 OK'), code('"jsonrpc": "2.0", "id": 1,'), typed('"result": ', 'SendMessageResponse')],
    rightReply: [code('HTTP/1.1 200 OK'), code('Content-Type: application/a2a+json'), typed('body: ', 'SendMessageResponse')],
  },
  {
    rpc: 'rpc GetTask(GetTaskRequest) returns (Task)',
    left: [code('POST /a2a/jsonrpc'), code('"jsonrpc": "2.0", "id": 3,'), bold('"method": "GetTask",'), code('"params": {"id": "d0c28826",'), code('"historyLength": 0}', { indent: 11 })],
    right: [bold('GET /a2a/rest/tasks/bbfb9ea5'), code('?historyLength=0', { indent: 4 }), note('no body: the path and query carry the request')],
    leftReply: [code('HTTP/1.1 200 OK'), code('"jsonrpc": "2.0", "id": 3,'), typed('"result": ', 'Task')],
    rightReply: [code('HTTP/1.1 200 OK'), code('Content-Type: application/a2a+json'), typed('body: ', 'Task')],
  },
];

function layout() {
  let top = 30;
  return ROWS.map(row => {
    const boxTop = top + 22;
    const requestHeight = heightOf(Math.max(row.left.length, row.right.length));
    const replyHeight = heightOf(Math.max(row.leftReply.length, row.rightReply.length));
    const replyTop = boxTop + requestHeight + 22;
    const placed = { row, headerY: top + 12, boxTop, requestHeight, replyTop, replyHeight };
    top = replyTop + replyHeight + 16;
    return placed;
  });
}

module.exports = figure('fig-two-json-bindings', {
  height: 436,
  title: 'One operation in two JSON bindings',
  desc: 'Two rows, SendMessage and GetTask, each headed by its gRPC rpc line from a2a.proto. In each row the left column shows the JSON-RPC request, a POST to /a2a/jsonrpc whose body names the method and carries the request message in params, and a reply whose result holds the response message. The right column shows HTTP+JSON, where the verb and path name the operation, the body or the path and query carry the request, and the reply body is the response message itself. The steps appear in capture order: each request, then its reply.',
}, f => {
  const rows = layout();
  f.kicker(20, 18, 'A · JSON-RPC');
  f.kicker(334, 18, 'B · HTTP+JSON');
  for (const placed of rows) {
    f.text(20, placed.headerY, 'gRPC', { size: SIZE, hue: 'ink-mute', weight: 700 });
    f.text(62, placed.headerY, placed.row.rpc, { size: SIZE });
    f.rule(320, placed.boxTop, 320, placed.replyTop + placed.replyHeight, { dash: 'dashed' });
  }
  let step = 0;
  for (const placed of rows) {
    const { row, boxTop, requestHeight, replyTop, replyHeight } = placed;
    [[row.left, row.leftReply], [row.right, row.rightReply]].forEach(([request, reply], side) => {
      f.beat(++step);
      const box = panel(f, COLUMNS[side], boxTop, WIDTH, requestHeight, 'violet', request);
      f.beat(++step);
      f.arrow([box.cx, box.bottom], [box.cx, replyTop - 1], { style: 'reply' });
      panel(f, COLUMNS[side], replyTop, WIDTH, replyHeight, 'blue', reply);
    });
  }
});
