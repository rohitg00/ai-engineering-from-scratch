'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

const rea = [
  { hue: 'blue', title: 'CLI and MCP', sub: ['153 commands, 207 tools, 6 prompts', 'one BinarySession behind both'] },
  { hue: 'blue', title: 'BinarySession', sub: ['one target, one bound provider', 'the registry selects, never replaces'] },
  { hue: 'teal', title: 'Evidence', sub: ['16 fields, ev_ content hash', 'EvidenceLedger, snapshots, bundles'] },
  { hue: 'blue', title: 'contracts and errors', sub: ['Zod schemas for every tool', 'code, category, message, retryable'] },
  { hue: 'violet', title: 'GhidraProvider, GhidraClient', sub: ['profile digest, private copy', 'JSON lines over bridge.sock'] },
];
const ghidra = [
  { hue: 'violet', title: 'ReaGhidraBridge.java', sub: ['a GhidraScript, the last -postScript', 'one Program, one socket client'] },
  { hue: 'violet', title: 'analyzeHeadless import', sub: ['loader chosen from the header', '-readOnly, default auto-analysis'] },
  { hue: 'violet', title: 'FunctionManager, ReferenceManager', sub: ['BasicBlockModel, Listing text', '13 procedures, 39 strings here'] },
  { hue: 'violet', title: 'DecompInterface, decompile', sub: ['native binary for mac_arm_64', 'pseudocode and high p-code'] },
  { hue: 'violet', title: 'the Program database', sub: ['addresses, symbols, references', 'deleted on close: -deleteProject'] },
];

module.exports = figure('fig-1-1', {
  height: 492,
  title: 'What rea standardizes and what it leaves to Ghidra',
  desc: 'Two stacks under one host band for macOS 26.2 arm64 with Node 22.22.0 and JDK 21.0.12.1. The left stack is rea 6.7.0: the CLI and MCP adapters with 153 commands, 207 tools, and 6 prompts over one BinarySession, the session with one target and one bound provider that the registry selects and never replaces, the Evidence record with 16 fields and an ev_ content hash kept in the EvidenceLedger, the Zod contracts and the error projection with code, category, message, and retryable, and the GhidraProvider and GhidraClient that send JSON lines over bridge.sock. The right stack is Ghidra 12.1.4: ReaGhidraBridge.java as the last post-script, the analyzeHeadless import with the loader chosen from the header, the FunctionManager, ReferenceManager, and BasicBlockModel that found 13 procedures and 39 strings, the DecompInterface with the native decompile binary for mac_arm_64, and the Program database deleted on close. The bottom band is the artifact ledger-arm64-O1 and its private copy target-01b5d08b08fb.bin.',
}, f => {
  f.rect(20, 28, 600, 30, { fill: color('paper'), stroke: color('ink-mute') });
  f.text(30, 47, 'host · macOS 26.2 arm64 · Node 22.22.0 · JDK 21.0.12.1 · GHIDRA_INSTALL_DIR set', { size: 11, hue: 'ink-soft' });
  f.rule(320, 66, 320, 414, { dash: 'dashed' });
  f.kicker(20, 80, 'rea 6.7.0 · what it standardizes');
  f.kicker(336, 80, 'Ghidra 12.1.4 · what rea leaves to it');
  rea.forEach((item, index) => f.box({ x: 20, y: 90 + index * 66, w: 284, h: 56, titleSize: 12, ...item }));
  ghidra.forEach((item, index) => f.box({ x: 336, y: 90 + index * 66, w: 284, h: 56, titleSize: 12, ...item }));
  f.box({ x: 20, y: 424, w: 284, h: 56, hue: 'green', title: 'ledger-arm64-O1', sub: ['mach-o arm64, 33872 bytes', 'sha256 starts 01b5d08b'], titleSize: 12 });
  f.box({ x: 336, y: 424, w: 284, h: 56, hue: 'green', title: 'target-01b5d08b08fb.bin', sub: ['the private copy Ghidra imports', 'same bytes, deleted on close'], titleSize: 12 });
});
