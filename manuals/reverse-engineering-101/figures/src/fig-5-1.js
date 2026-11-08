'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

const rows = [
  ['evidence_id', 'ev_b492c85eb9570bd5f8e8', 'SHA-256 of the solid rows', true],
  ['subject.name', 'ledger-arm64-O1', 'display only, not hashed', false],
  ['subject.digest.sha256', '01b5d08b08fb94678be5', 'identity of the analysed bytes', true],
  ['subject.format', 'mach-o', null, true],
  ['subject.architecture', 'arm64', null, true],
  ['subject.local_path', '$CAPTURE/fixtures/ledger-arm64-O1', 'display only, not hashed', false],
  ['provider', 'ghidra, Ghidra, 12.1.4', 'the engine, with its version', true],
  ['analysis_profile', 'digest 3fc72c9b4b78498fb9', 'the committed Ghidra settings', true],
  ['predicate_type', 'rea.analysis', null, true],
  ['operation', 'analyze_function', null, true],
  ['parameters', '{"procedure": "_percent_change"}', 'the caller input, in full', true],
  ['raw_result', 'object: the Ghidra report', 'provider form, or null', true],
  ['normalized_result', 'object: the dossier, 16 keys', 'what the agent reads', true],
  ['confidence', 'observed', 'observed, derived, or inferred', true],
  ['authority', 'the artifact bytes', 'one of five source kinds', true],
  ['environment', 'null', null, true],
  ['limitations', '10 strings', 'kept with the claim, in full', true],
  ['relationship_coverage', 'complete', 'in the hash also when null', true],
  ['locations', '[]', null, true],
  ['evidence_links', '[]', 'ev_ ids this record derives from', true],
];

module.exports = figure('fig-5-1', {
  height: 534,
  title: 'The sixteen fields of one Evidence record',
  desc: 'A table of the Evidence record ev_b492c85eb9570bd5f8e8 for analyze_function on _percent_change in ledger-arm64-O1, one row per field with its captured value: the subject digest, format and architecture, the Ghidra 12.1.4 provider, the analysis profile digest, predicate type, operation, parameters, raw and normalized results, confidence observed, the artifact bytes as authority, a null environment, ten limitations, complete relationship coverage, and empty locations and links. Two rows are drawn dashed, subject.name and subject.local_path, because the evidence id hashes every other row and not these two.',
}, f => {
  f.kicker(20, 18, 'ev_b492c85eb957, analyze_function _percent_change');
  f.kicker(440, 18, 'Field notes');
  f.box({ x: 20, y: 26, w: 400, h: 26, hue: 'teal', title: 'Evidence record, 16 fields, strict schema', align: 'left', titleSize: 11.5, pad: 10 });
  rows.forEach(([field, value, note, hashed], index) => {
    const y = 52 + index * 22;
    f.rect(20, y, 400, 22, { fill: color('paper'), stroke: hashed ? color('panel-edge') : color('ink-mute'), dash: hashed ? undefined : 'dashed' });
    f.text(30, y + 15, field, { size: 11, hue: 'ink-soft' });
    f.text(180, y + 15, value, { size: 11 });
    if (note) {
      f.rule(420, y + 11, 434, y + 11, { hue: hashed ? 'teal' : 'ink-mute', dash: hashed ? undefined : 'dashed' });
      f.text(440, y + 15, note, { size: 11, serif: true, hue: 'ink-soft' });
    }
  });
  f.text(20, 516, 'Solid rows enter the id hash. Dashed rows are display fields. Digests show their first hex digits.', { size: 11, serif: true, hue: 'ink-soft' });
});
