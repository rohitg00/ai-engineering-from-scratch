'use strict';

const { figure } = require('../../../_shared/figkit.js');

const lanes = [
  { title: 'agent', sub: 're101-capture', hue: 'plum' },
  { title: 'rea mcp', sub: 'server 6.7.0', hue: 'indigo' },
  { title: 'session', sub: 'BinarySession', hue: 'blue' },
  { title: 'client', sub: 'GhidraClient', hue: 'violet' },
  { title: 'Ghidra', sub: 'headless JVM', hue: 'violet' },
  { title: 'bundle-O1', sub: 'the file', hue: 'teal' },
  { title: 'model', sub: 'not recorded', hue: 'plum' },
];
const cx = index => 52 + index * 89;

const rows = [
  [0, 1, 'call', 'tools/call open_binary', 'a call · solid ink', 125],
  [1, 0, 'reply', 'mach-o, executable, arm64', 'a reply · dashed ink', 125],
  [0, 1, 'call', 'analyze_function', 'procedure _percent_change · a call', 125],
  [2, 4, 'effect', 'launch java AnalyzeHeadless', 'an outside effect · dashed olive'],
  [4, 3, 'state', 'analysis_complete: true', 'a state change · dashed amber'],
  [1, 0, 'event', 'MCP tool execution completed', 'an event on stderr · dotted indigo', 125],
  [1, 5, 'write', 'export 178629 bytes, 8 records', 'a durable write · solid teal'],
  [1, 0, 'fail', 'invalid_request: _nothing', 'a failure · dashed rose', 125],
  [0, 6, 'model', 'finding cites ev_b492c85e', 'a model call · solid plum'],
];

module.exports = figure('fig-0-1', {
  height: 500,
  title: 'Reading a sequence figure in this manual',
  desc: 'Seven lifelines: the agent of the capture kit, the rea MCP server 6.7.0, the BinarySession, the GhidraClient, the headless Ghidra JVM, the exported bundle file, and the model of the agent. Nine numbered rows use the eight arrow styles: tools/call open_binary as a solid ink call, the mach-o executable arm64 answer as a dashed ink reply, analyze_function for _percent_change as a call, the launch of java AnalyzeHeadless as a dashed olive outside effect, analysis_complete true as a dashed amber state change, the stderr log line MCP tool execution completed as a dotted indigo event, the export of 178629 bytes and 8 records as a solid teal durable write, invalid_request for _nothing as a dashed rose failure, and the finding that cites ev_b492c85e as a solid plum model call.',
}, f => {
  lanes.forEach((lane, index) => {
    f.box({ x: cx(index), y: 8, w: 86, h: 40, hue: lane.hue, title: lane.title, sub: lane.sub, titleSize: 11, anchor: 'middle', pad: 3 });
    f.lifeline(cx(index), 48, 492);
  });
  rows.forEach(([from, to, style, label, note, labelX], index) => {
    const y = 84 + index * 46;
    f.beat(index + 1);
    f.step(16, y, index + 1, { hue: style === 'fail' ? 'rose' : undefined });
    const x1 = cx(from);
    const x2 = cx(to);
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label, note, labelX });
  });
});
