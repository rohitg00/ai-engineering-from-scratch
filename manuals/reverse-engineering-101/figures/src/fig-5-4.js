'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

function block(f, x, y, w, hue, head, lines) {
  const h = 26 + lines.length * 15 + 6;
  f.rect(x, y, w, h, { fill: color(`${hue}-fill`), stroke: color(`${hue}-ink`) });
  f.text(x + 10, y + 18, head, { size: 12, weight: 700, hue });
  lines.forEach((line, index) => f.text(x + 10, y + 36 + index * 15, line, { size: 11 }));
  return { x, y, w, h, cx: x + w / 2, bottom: y + h };
}

module.exports = figure('fig-5-4', {
  height: 404,
  title: 'One analyze_function call through the snapshot cache',
  desc: 'Top row: the call analyze_function with procedure _percent_change passes the cacheable test, because Ghidra marks the operation cachePolicy snapshot and mutatesArtifact false, and becomes a query id. Middle: the query id is the SHA-256 of canonical JSON holding the target digest 01b5d08b08fb with kind executable, format mach-o and architecture arm64, the binding of provider ghidra 12.1.4 with profile digest 3fc72c9b4b7, the operation, and the parameters. Bottom left: on a hit the entry is replayed with the limitation that the call did not re-run the provider. Bottom right: on a miss the Ghidra bridge answers, Evidence ev_b492c85e is recorded, and an entry is stored under the id. Last row: a mutating call such as annotate_native_function invalidates the cache before rea dispatches it to Ghidra, even when its reply later fails, and later snapshot exports are refused.',
}, f => {
  const call = f.box({ x: 20, y: 28, w: 220, h: 52, hue: 'blue', title: 'analyze_function', sub: '{"procedure": "_percent_change"}' });
  const gate = f.box({ x: 270, y: 28, w: 160, h: 52, hue: 'grey', title: 'cacheable?', sub: ['cachePolicy snapshot', 'mutatesArtifact false'] });
  const key = f.box({ x: 460, y: 28, w: 160, h: 52, hue: 'teal', title: 'query id', sub: ['query_ and a SHA-256'] });
  f.arrow(call.right(), [gate.x - 1, call.cy], { style: 'call' });
  f.arrow(gate.right(), [key.x - 1, gate.cy], { style: 'call', label: 'yes' });
  const contents = block(f, 20, 104, 600, 'teal', 'query_ = SHA-256 of canonical JSON', [
    'target: sha256 01b5d08b, executable, mach-o, arm64',
    'binding: provider ghidra 12.1.4, analysis_profile digest 3fc72c9b',
    'operation: analyze_function',
    'parameters: {"procedure": "_percent_change"}',
  ]);
  f.arrow([key.cx, 80], [key.cx, contents.y - 1], { style: 'call' });
  const hit = f.box({ x: 20, y: 236, w: 290, h: 74, hue: 'teal', title: 'entry found: replay it', sub: ['limitation added: Loaded from a local', 'REA analysis snapshot; this call did', 'not re-run the provider.'] });
  const miss = f.box({ x: 330, y: 236, w: 290, h: 74, hue: 'violet', title: 'no entry: call the Ghidra bridge', sub: ['5 to 7 s for the first call on a target,', 'then Evidence ev_b492c85e is recorded', 'and an entry is stored under the id'] });
  f.arrow([165, contents.bottom], [165, hit.y - 1], { style: 'reply', label: 'hit' });
  f.arrow([475, contents.bottom], [475, miss.y - 1], { style: 'call', label: 'miss' });
  const mutate = f.box({ x: 20, y: 334, w: 290, h: 56, hue: 'amber', title: 'annotate_native_function', sub: ['a mutating call, before rea', 'dispatches it to Ghidra'] });
  const off = f.box({ x: 330, y: 334, w: 290, h: 56, hue: 'rose', title: 'invalidateSnapshot', sub: ['entries dropped, even if the call fails,', 'lookups miss, snapshot exports refused'] });
  f.arrow(mutate.right(), [off.x - 1, mutate.cy], { style: 'state' });
});
