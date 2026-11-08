'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

function block(f, x, y, w, hue, head, lines) {
  const h = 26 + lines.length * 15 + 6;
  f.rect(x, y, w, h, { fill: color(`${hue}-fill`), stroke: color(`${hue}-ink`) });
  f.text(x + 10, y + 18, head, { size: 12, weight: 700, hue });
  lines.forEach((line, index) => f.text(x + 10, y + 36 + index * 15, line, { size: 11 }));
  return { x, y, w, h, cx: x + w / 2, bottom: y + h };
}

module.exports = figure('fig-5-2', {
  height: 500,
  title: 'A ResidualUnknown and its revision chain',
  desc: 'Left, revision 1 of the unknown that compare_functions records when the _total comparison is changed: an unk_ id hashed from domain, question, scope digest and comparison scope, revision 1 with a null predecessor, status contradicted, severity medium, domain function-comparison, a comparison scope that names the comparison and its five changed dimensions, the left dossier and the comparison record as supporting evidence and the right dossier as contradicting evidence, the artifact bytes as required authority, required confidence observed, one recommended analyze_function probe, and one mutation evidence id. Right, what update_unknown changes: expected_revision 1, revision 2, the previous revision digest, a new revision digest, status resolved with a verified resolution, and two mutation evidence ids. Below, the mutation Evidence record that every change writes, from provider rea-unknown-registry.',
}, f => {
  f.kicker(20, 18, 'record_unknown, as compare_functions calls it');
  f.kicker(400, 18, 'update_unknown');
  const first = block(f, 20, 30, 330, 'amber', 'ResidualUnknown, revision 1', [
    'unknown_id: unk_ + SHA-256 of domain,',
    '  question, scope_digest, comparison scope',
    'revision: 1',
    'previous_revision_digest: null',
    'revision_digest: SHA-256 of these rows',
    'scope_digest: the open target digest',
    'question: Function comparison is changed',
    '  (comparison ev_40ba96d8)',
    'status: contradicted',
    'severity: medium',
    'domain: function-comparison',
    'comparison_conclusion_scope: ev_40ba96d8,',
    '  assembly, cfg, pseudocode, references,',
    '  strings_names',
    'supporting_evidence_ids: ev_a1fe53ff,',
    '  ev_40ba96d8',
    'contradicting_evidence_ids: ev_bfe3275b',
    'required_authority: the artifact bytes',
    'required_confidence: observed',
    'recommended_probes: analyze_function',
    'relationships: [], resolution: null',
    'mutation_evidence_ids: 1 registry record',
  ]);
  const second = block(f, 400, 30, 220, 'amber', 'after update_unknown', [
    'expected_revision: 1',
    'revision: 2',
    'previous_revision_digest:',
    '  the revision 1 digest',
    'revision_digest: new',
    'status: resolved',
    'resolution: verified,',
    '  rationale, evidence_ids',
    'mutation_evidence_ids: 2',
    'unchanged: unknown_id,',
    '  question, domain,',
    '  scope_digest, comparison scope',
  ]);
  f.arrow([first.x + first.w, 120], [second.x - 1, 120], { style: 'state', label: 'update' });
  const mutation = f.box({ x: 20, y: 432, w: 600, h: 56, hue: 'teal', title: 'mutation Evidence: provider rea-unknown-registry, version 1', sub: ['predicate rea.residual-unknown-mutation, confidence derived, authority analyst-inference', 'limitation: Registry mutation evidence records analyst intent, not proof of the answer.'] });
  f.arrow([110, first.bottom], [110, mutation.y - 1], { style: 'write' });
  f.arrow([510, second.bottom], [510, mutation.y - 1], { style: 'write', label: 'one more record' });
});
