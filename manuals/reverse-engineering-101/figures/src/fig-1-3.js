'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

const rows = [
  ['evidence_id', 'ev_ + 64 hex digits', 'SHA-256 of the semantic content'],
  ['subject', 'ledger-arm64-O1, arm64', 'mach-o, sha256 starts 01b5d08b'],
  ['provider', 'ghidra, Ghidra, 12.1.4', 'the engine that answered'],
  ['analysis_profile', 'digest 3fc72c9b', '25 contract parameters, hashed'],
  ['predicate_type', 'rea.analysis', 'the default tag'],
  ['operation', 'analyze_function', 'the MCP name behind rea function'],
  ['parameters', 'procedure _percent_change', 'part of the identity'],
  ['raw_result', 'value, limitations', 'the provider-native dossier'],
  ['normalized_result', 'the dossier', 'procedure, pseudocode, assembly, blocks'],
  ['confidence', 'observed', 'or derived, or inferred'],
  ['authority', 'the file on disk', 'one of five authorities'],
  ['environment', 'null', 'nothing was run'],
  ['limitations', '10 strings', '4 session, 5 dossier, 1 macOS'],
  ['relationship_coverage', 'complete', 'one diagnostic on call references'],
  ['locations', '[]', 'none for this operation'],
  ['evidence_links', '[]', 'no parent records'],
];

module.exports = figure('fig-1-3', {
  height: 478,
  title: 'The 16 fields of one Evidence record',
  desc: 'The Evidence record for analyze_function on _percent_change drawn as a table of its 16 fields with the value each one holds in the capture and a note on the right. evidence_id is ev_ and 64 hex digits, a SHA-256 of the semantic content. subject is ledger-arm64-O1, mach-o, arm64 with the sha256 01b5d08b08fb and a local_path. provider is ghidra, Ghidra, 12.1.4. analysis_profile has 25 parameters and the digest 3fc72c9b. predicate_type is rea.analysis. operation is analyze_function. parameters is the procedure _percent_change. raw_result holds value and limitations. normalized_result is the dossier with procedure, pseudocode, assembly, and blocks. confidence is observed, authority is the value for a static read of the file on disk, environment is null, limitations has 10 strings, relationship_coverage is complete with one diagnostic on call references, and locations and evidence_links are empty.',
}, f => {
  f.kicker(20, 18, 'one Evidence record');
  f.kicker(396, 18, 'what the field holds');
  f.box({ x: 20, y: 26, w: 360, h: 28, hue: 'teal', title: 'Evidence ev_b492c85e for analyze_function', align: 'left', titleSize: 11, pad: 10 });
  rows.forEach(([field, value, note], index) => {
    const y = 54 + index * 26;
    f.rect(20, y, 360, 26, { fill: color('paper'), stroke: color('panel-edge') });
    f.text(30, y + 17, field, { size: 12, hue: 'ink-soft' });
    f.text(188, y + 17, value, { size: 12 });
    f.rule(380, y + 13, 390, y + 13, { hue: 'teal' });
    f.text(396, y + 17, note, { size: 11, serif: true, hue: 'ink-soft' });
  });
});
