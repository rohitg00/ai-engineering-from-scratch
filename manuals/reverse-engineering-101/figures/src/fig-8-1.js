'use strict';

const { figure } = require('../../../_shared/figkit.js');

const lanes = [
  { x: 110, title: 'client', sub: 're101-capture 1.0.0', hue: 'grey' },
  { x: 320, title: 'rea mcp', sub: 'rea-agents 6.7.0, stdio', hue: 'blue' },
  { x: 530, title: 'Ghidra 12.1.4', sub: 'headless, fresh project', hue: 'violet' },
];
const rows = [
  [0, 1, 'call', 'initialize', 'protocolVersion 2025-06-18'],
  [1, 0, 'reply', 'rea 6.7.0, tools, prompts', 'instructions for the model'],
  [0, 1, 'call', 'tools/list', ''],
  [1, 0, 'reply', '207 tools', '284 ms'],
  [0, 1, 'call', 'open_binary ledger-arm64-O1', 'provider_id ghidra'],
  [1, 0, 'reply', 'mach-o arm64, 1,632 ms', 'install checked, no import yet'],
  [0, 1, 'call', 'list_procedures', 'the first Ghidra-backed call'],
  [1, 2, 'model', 'import, auto-analysis, bridge', 'deadline 330,000 ms'],
  [2, 1, 'reply', 'ready', 'one imported Program'],
  [1, 0, 'reply', '13 procedures, 6,349 ms', ''],
  [0, 1, 'call', 'procedure_assembly _grade', ''],
  [1, 0, 'reply', '15 instructions, 4 ms', 'served from the session'],
  [0, 1, 'call', 'close_binary', ''],
  [1, 2, 'effect', 'shutdown, delete project', 'ephemeral project removed'],
  [1, 0, 'reply', 'result null, 491 ms', ''],
];

module.exports = figure('fig-8-1', {
  height: 666,
  title: 'One connection from initialize to close_binary',
  desc: 'Three lifelines: the capture client re101-capture 1.0.0, rea mcp from rea-agents 6.7.0 over stdio, and Ghidra 12.1.4 headless with a fresh project. Fifteen numbered exchanges: initialize with protocolVersion 2025-06-18 and the reply naming rea 6.7.0 with tools and prompts; tools/list and the reply of 207 tools in 284 ms; open_binary on ledger-arm64-O1 with provider_id ghidra, answered mach-o arm64 in 1,632 ms after the install checks and before any import; list_procedures, which makes rea start the Ghidra import, auto-analysis and bridge under its 330,000 ms deadline, Ghidra reports ready, and the reply lists 13 procedures after 6,349 ms; procedure_assembly for _grade answered with 15 instructions in 4 ms from the session; close_binary, which shuts Ghidra down and deletes the ephemeral project, answered result null in 491 ms.',
}, f => {
  for (const lane of lanes) {
    f.box({ x: lane.x - 85, y: 8, w: 170, h: 40, hue: lane.hue, title: lane.title, sub: lane.sub, titleSize: 12 });
    f.lifeline(lane.x, 48, 658);
  }
  rows.forEach(([from, to, style, label, note], index) => {
    const y = 80 + index * 38;
    f.beat(index + 1);
    f.step(16, y, index + 1, { hue: style === 'model' ? 'violet' : undefined });
    const x1 = lanes[from].x;
    const x2 = lanes[to].x;
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label, note: note || undefined });
  });
});
