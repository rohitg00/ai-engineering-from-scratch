'use strict';

const { figure } = require('../../../_shared/figkit.js');

const columns = [
  { x: 16, kicker: 'v1, two modes', outer: 'a tuple', outerSub: ['(mode, data)', 'shape changes with modes'], inner: 'data', innerSub: ['(ToolMessage, metadata)', 'langgraph_node: tools'], where: 'chunk 1 of messages' },
  { x: 222, kicker: 'v2, any modes', outer: 'a StreamPart dict', outerSub: ['type, ns, data', 'type: messages'], inner: 'data', innerSub: ['message: ToolMessage', 'metadata: node tools'], where: 'part 2' },
  { x: 428, kicker: 'v3 event', outer: 'an event frame', outerSub: ['type, method, params, seq', 'method: tools'], inner: 'params.data', innerSub: ['event: tool-finished', 'output: ToolMessage'], where: 'seq 8' },
];

module.exports = figure('fig-4-1b', {
  height: 270,
  title: 'The same tool result in v1, v2, and v3',
  desc: 'Three columns, one per stream API, each carrying the ToolMessage 5 of the add tool. v1 with two modes yields a tuple of the mode and the data, and the data is the ToolMessage with its metadata. v2 yields a StreamPart dict with type, ns, and data. v3 yields an event frame with type, method, params, and seq, where method is tools and the data is the tool-finished event with the ToolMessage as output.',
}, f => {
  columns.forEach(col => {
    f.kicker(col.x, 18, col.kicker);
    const outer = f.box({ x: col.x, y: 30, w: 196, h: 64, hue: 'indigo', title: col.outer, sub: col.outerSub, align: 'left' });
    const inner = f.box({ x: col.x, y: 128, w: 196, h: 64, hue: 'green', title: col.inner, sub: col.innerSub, align: 'left' });
    f.arrow([col.x + 98, outer.y + outer.h], [col.x + 98, inner.y - 1], { style: 'event' });
    f.text(col.x, 218, col.where, { size: 11, serif: true, hue: 'ink-soft' });
  });
  f.rule(217, 10, 217, 226, { dash: 'dashed' });
  f.rule(423, 10, 423, 226, { dash: 'dashed' });
  f.text(16, 254, 'All three carry the same ToolMessage, with content 5 and tool_call_id call_1.', { size: 11, serif: true, hue: 'ink-soft' });
});
