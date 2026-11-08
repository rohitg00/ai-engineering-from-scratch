'use strict';

const { figure } = require('../../../_shared/figkit.js');

const lanes = [
  { x: 110, name: 'AGENT', hue: 'plum' },
  { x: 260, name: 'REA MCP', hue: 'blue' },
  { x: 410, name: 'GHIDRA CLIENT', hue: 'violet' },
  { x: 560, name: 'JAVA BRIDGE', hue: 'violet' },
];
const rows = [
  [0, 1, 'call', 'open_binary', 'about 1.6 s of readiness checks, no import yet'],
  [1, 0, 'reply', 'mach-o executable arm64', null],
  [0, 1, 'call', 'list_procedures', null],
  [1, 2, 'call', 'start()', 'rea-ghidra-* root, bridge.sock'],
  [2, 3, 'call', 'AnalyzeHeadless -import', '-readOnly -deleteProject -postScript'],
  [3, 2, 'reply', 'ping ok', 'analysis_complete true, token checked'],
  [2, 3, 'call', '{id, token, method, params}', 'one JSON line on the socket'],
  [3, 2, 'reply', '{id, ok true, result}', '13 functions, 4 external'],
  [1, 0, 'reply', 'Evidence ev_3c6350b2', '5 to 7 s, import plus auto-analysis'],
  [0, 1, 'call', 'procedure_assembly _grade', 'under 100 ms on the same socket'],
];

module.exports = figure('fig-4-1', {
  height: 486,
  title: 'One open and three questions over MCP',
  desc: 'Four lifelines: the agent, the rea MCP server, the Ghidra client inside rea, and the Java bridge inside analyzeHeadless. open_binary returns in about 1.6 seconds after the provider readiness checks, with no headless import yet. list_procedures makes the client start: a private runtime root, a Unix socket, a hashed copy of the target, then java with AnalyzeHeadless, -import, -readOnly and -deleteProject, then a ping handshake, then one JSON request line and one reply. The Evidence returns after 5 to 7 seconds. procedure_assembly on the same socket takes under 100 ms.',
}, f => {
  for (const lane of lanes) {
    f.box({ x: lane.x, y: 10, w: 124, h: 30, hue: lane.hue, title: lane.name, titleSize: 12, anchor: 'middle' });
    f.lifeline(lane.x, 40, 470);
  }
  rows.forEach(([from, to, style, label, note], index) => {
    const y = 76 + index * 42;
    f.step(24, y, index + 1);
    const x1 = lanes[from].x;
    const x2 = lanes[to].x;
    const options = { style, label, labelX: (x1 + x2) / 2 };
    if (note) options.note = note;
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], options);
  });
});
