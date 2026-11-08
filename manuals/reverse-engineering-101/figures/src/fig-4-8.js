'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

const rows = [
  ['procedure', '_grade 0x100000518', 'entry, classification, body 60 B'],
  ['pseudocode', 'one string', 'decompiler text, compilable false'],
  ['assembly', '15 lines', 'Listing text, address first'],
  ['comments', '[]', 'database comments at the entry'],
  ['callers', '[]', 'resolved callers only'],
  ['callees', '[]', 'resolved callees only'],
  ['incoming_references', '1 DATA', 'from 0x10000811a, no owning procedure'],
  ['outgoing_references', '2', 'CONDITIONAL_JUMP, DATA read'],
  ['unresolved_calls', '[]', 'calls with no known destination'],
  ['referenced_strings', '[]', 'strings the body reaches'],
  ['referenced_names', '2', 'LAB_10000054c, DAT_1000007d0'],
  ['basic_blocks', '3', 'successors inside the body only'],
  ['native_api', '__cdecl, default', 'signature facts, jump_tables []'],
  ['native_value_flow', '14 ops, 12 edges', 'high p-code, truncated false'],
  ['facet_availability', '8 facets, available', 'whether each facet was observed'],
  ['limitations', '4 + 10 on the record', 'plus 3 in native_api, 5 in value flow'],
];

module.exports = figure('fig-4-8', {
  height: 444,
  title: 'The sixteen facets of the _grade dossier',
  desc: 'A table of the sixteen keys of normalized_result in the analyze_function record for _grade: procedure, pseudocode, assembly, comments, callers, callees, incoming_references, outgoing_references, unresolved_calls, referenced_strings, referenced_names, basic_blocks, native_api, native_value_flow, facet_availability and limitations, each with its value for _grade and a note on what the facet holds.',
}, f => {
  f.kicker(20, 18, 'facet');
  f.kicker(200, 18, 'for _grade');
  f.kicker(380, 18, 'what it holds');
  f.box({ x: 20, y: 26, w: 600, h: 26, hue: 'teal', title: 'Evidence ev_41e8ca1c · analyze_function · observed', align: 'left', titleSize: 12 });
  rows.forEach(([field, value, note], index) => {
    const y = 52 + index * 24;
    f.rect(20, y, 600, 24, { fill: color('paper'), stroke: color('panel-edge') });
    f.text(32, y + 16, field, { size: 11.5, hue: 'ink-soft' });
    f.text(200, y + 16, value, { size: 11.5 });
    f.rule(360, y + 12, 372, y + 12, { hue: 'violet' });
    f.text(380, y + 16, note, { size: 11, serif: true, hue: 'ink-soft' });
  });
});
