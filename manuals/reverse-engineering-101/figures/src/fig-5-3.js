'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-5-3', {
  height: 262,
  title: 'Three empty lists and what each one proves',
  desc: 'Three columns. A: the _percent_change dossier reports callees as an empty array with relationship coverage complete, which means every resolved call reference was returned, so no resolved callee was seen and calls at run time are not proven absent. B: export_evidence_bundle reports zero unknowns, because no record_unknown call was made, so no question was written and questions can still exist. C: rea compare lists a record with an empty right_evidence_ids array and classifies it unknown as an unresolved branch, because the bundle has no completeness marker, so the record is in one bundle only and removal is not concluded.',
}, f => {
  const columns = [
    { x: 20, kicker: 'A · analyze_function', top: { title: '"callees": []', sub: 'ev_b492c85e' }, middle: { title: 'coverage: complete', sub: ['every resolved call', 'reference returned'] }, bottom: { title: 'no resolved callee seen', sub: 'runtime calls not proven' } },
    { x: 225, kicker: 'B · the bundle export', top: { title: '"unknowns": 0', sub: '10-mcp-14, bundle O1' }, middle: { title: 'no record_unknown call', sub: ['the session held no', 'ResidualUnknown yet'] }, bottom: { title: 'no question was written', sub: 'questions can still exist' } },
    { x: 430, kicker: 'C · rea compare', top: { title: '"right_evidence_ids": []', sub: 'one record of bundle O1', titleSize: 11 }, middle: { title: 'classification: unknown', sub: ['unresolved_branch, no', 'completeness marker'] }, bottom: { title: 'in one bundle only', sub: 'removal is not concluded' } },
  ];
  columns.forEach(column => {
    f.kicker(column.x, 18, column.kicker);
    f.box({ x: column.x, y: 28, w: 190, h: 52, hue: 'grey', title: column.top.title, titleSize: column.top.titleSize, sub: column.top.sub });
    f.arrow([column.x + 95, 80], [column.x + 95, 105], { style: 'call' });
    f.box({ x: column.x, y: 106, w: 190, h: 60, hue: 'amber', title: column.middle.title, titleSize: 11.5, sub: column.middle.sub });
    f.arrow([column.x + 95, 166], [column.x + 95, 191], { style: 'state' });
    f.box({ x: column.x, y: 192, w: 190, h: 52, hue: 'grey', dash: 'dashed', title: column.bottom.title, titleSize: 11.5, sub: column.bottom.sub });
  });
});
