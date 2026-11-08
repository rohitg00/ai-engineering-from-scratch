'use strict';

const { figure } = require('../../../_shared/figkit.js');

const lanes = [
  { title: 'you', sub: 'the reader', hue: 'grey' },
  { title: 'rea 6.7.0', sub: 'one-shot CLI', hue: 'blue' },
  { title: 'session', sub: 'BinarySession', hue: 'blue' },
  { title: 'client', sub: 'GhidraClient', hue: 'violet' },
  { title: 'Ghidra JVM', sub: 'bridge.sock', hue: 'violet' },
  { title: 'artifact', sub: 'ledger-arm64-O1', hue: 'green' },
];
const cx = index => 60 + index * 104;

const rows = [
  [0, 1, 'call', 'rea function _percent_change', '--provider ghidra --format json', 125],
  [1, 2, 'call', 'runDirectAnalysis analyze_function', '{ procedure: _percent_change }'],
  [2, 5, 'call', 'parse header, SHA-256', 'mach-o magic, 64 KiB chunks'],
  [2, 3, 'state', 'ghidra bound, selection request', 'profile digest 3fc72c9b'],
  [3, 4, 'effect', 'java AnalyzeHeadless -import', '-readOnly -deleteProject, 330 s deadline'],
  [3, 5, 'call', 'copy as target-01b5d08b08fb.bin', 'private runtime root rea-ghidra-*'],
  [4, 3, 'state', 'analysis_complete: true', 'ping handshake, run_id and token checked'],
  [3, 4, 'call', 'analyze_function', 'one JSON line on bridge.sock'],
  [4, 3, 'reply', 'ok: true, result', 'procedure, pseudocode, 6 instructions'],
  [3, 2, 'reply', 'Evidence ev_b492c85e', 'confidence observed, 10 limitations'],
  [3, 4, 'call', 'shutdown', 'project deleted, 10 s deadline'],
  [1, 0, 'reply', 'JSON on stdout, exit 0', '7 to 9 s on the capture Mac', 125],
];

module.exports = figure('fig-1-2', {
  height: 604,
  title: 'One rea function run, step by step',
  desc: 'Six lifelines: you, the rea 6.7.0 one-shot CLI, the BinarySession, the GhidraClient, the headless Ghidra JVM behind bridge.sock, and the artifact ledger-arm64-O1. Twelve numbered rows: rea function _percent_change with --provider ghidra --format json, runDirectAnalysis for analyze_function with the procedure _percent_change, the session parses the Mach-O header and hashes the file in 64 KiB chunks, ghidra is bound with selection source request and profile digest 3fc72c9b4b78498f, the client launches java AnalyzeHeadless with -import, -readOnly and -deleteProject under a 330 second deadline, the file is copied as target-01b5d08b08fb.bin into a private runtime root, the ping handshake returns analysis_complete true after the run_id and token are checked, one JSON line asks analyze_function, the reply carries ok true with the procedure, the pseudocode and 6 instructions, the client returns Evidence ev_b492c85e with confidence observed and 10 limitations, shutdown deletes the project within 10 seconds, and the JSON reaches stdout with exit 0 after 7 to 9 seconds.',
}, f => {
  lanes.forEach((lane, index) => {
    f.box({ x: cx(index), y: 8, w: 100, h: 40, hue: lane.hue, title: lane.title, sub: lane.sub, titleSize: 11, anchor: 'middle', pad: 3 });
    f.lifeline(cx(index), 48, 596);
  });
  rows.forEach(([from, to, style, label, note, labelX], index) => {
    const y = 84 + index * 44;
    f.beat(index + 1);
    f.step(16, y, index + 1);
    const x1 = cx(from);
    const x2 = cx(to);
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label, note, labelX });
  });
});
