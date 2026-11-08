'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

function block(f, x, y, w, hue, head, lines) {
  const h = 26 + lines.length * 15 + 6;
  f.rect(x, y, w, h, { fill: color(`${hue}-fill`), stroke: color(`${hue}-ink`) });
  f.text(x + 10, y + 18, head, { size: 12, weight: 700, hue });
  lines.forEach((line, index) => f.text(x + 10, y + 36 + index * 15, line, { size: 11 }));
  return { x, y, w, h, cx: x + w / 2, bottom: y + h };
}

module.exports = figure('fig-6-2', {
  height: 416,
  title: 'inspect_wasm_artifact on ledger.wasm',
  desc: 'Top row: two entry points, the CLI command rea inspect-wasm-artifact and the MCP call tools/call inspect_wasm_artifact. Both reach the wabt-artifact provider, which reads REA_WABT_BIN_DIRECTORY=/opt/homebrew/bin and copies ledger.wasm, 290 bytes, SHA-256 699f6ff7, to a read-only module.wasm in a private workspace. Third row: three WABT 1.0.42 programs run on the copy, wasm-validate --enable-all, wasm-objdump -h -x, and wasm2wat --enable-all. Bottom: one Evidence record ev_3a09e4b0, observed, with validation valid, seven sections, an interface of one import and five exports, the decoded WAT with SHA-256 37eab56a, a tool profile, and five limitations. runtime_execution and network_fetch are not-performed. The CLI prints the record, and MCP returns the same record as structuredContent with the untrusted-content marker.',
}, f => {
  const cli = f.box({ x: 20, y: 28, w: 290, h: 48, hue: 'blue', title: 'rea inspect-wasm-artifact', sub: 'CLI, exit 0 after 1.5 s' });
  const mcp = f.box({ x: 330, y: 28, w: 290, h: 48, hue: 'indigo', title: 'tools/call inspect_wasm_artifact', sub: 'MCP step 24, ok after 404 ms' });
  const adapter = f.box({ x: 20, y: 104, w: 600, h: 56, hue: 'blue', title: 'wabt-artifact provider, REA_WABT_BIN_DIRECTORY=/opt/homebrew/bin', titleSize: 12, sub: ['copies ledger.wasm, 290 bytes, sha256 699f6ff7, to a read-only module.wasm'] });
  f.arrow([cli.cx, 76], [cli.cx, adapter.y - 1], { style: 'call', label: 'path' });
  f.arrow([mcp.cx, 76], [mcp.cx, adapter.y - 1], { style: 'call', label: 'path' });

  const programs = [
    ['wasm-validate', '--enable-all', 'result: valid'],
    ['wasm-objdump', '-h -x', 'result: 7 sections'],
    ['wasm2wat', '--enable-all', 'result: decoded WAT'],
  ].map(([tool, args, result], index) => {
    const x = 20 + index * 205;
    const box = f.box({ x, y: 196, w: 190, h: 62, hue: 'grey', title: tool, sub: [`${args}, banner 1.0.42`, result] });
    f.arrow([box.cx, adapter.y + adapter.h], [box.cx, box.y - 1], { style: 'call' });
    return box;
  });

  const record = block(f, 20, 294, 600, 'teal', 'Evidence ev_3a09e4b0, confidence observed', [
    'sections: Type, Import, Function, Memory, Export, Code, Data',
    'interface: 1 import env.log, 5 exports with typed signatures',
    'wat: decoded-wat, sha256 37eab56a, tool_profile: 3 commands',
    'limitations: 5, runtime_execution and network_fetch not-performed',
  ]);
  programs.forEach(box => f.arrow([box.cx, box.y + box.h], [box.cx, record.y - 1], { style: 'reply' }));
  f.text(20, record.bottom + 20, 'The CLI prints this record. MCP returns the same id as structuredContent.', { size: 11, serif: true, hue: 'ink-soft' });
});
