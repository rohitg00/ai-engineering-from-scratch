'use strict';

const { figure } = require('../../../_shared/figkit.js');

const columns = [
  {
    x: 20,
    hue: 'amber',
    dash: undefined,
    claims: [
      ['percent-change-pseudocode', 'status pass, observed_status unchanged'],
      ['percent-change-assembly', 'status pass, observed_status unchanged'],
    ],
    comparison: ['compare_functions ev_2161e17a', ['left ev_b492c85e (ledger-arm64-O1)', 'right ev_142cc943 (ledger-arm64-O2)']],
    tail: { hue: 'grey', title: 'no unknown in the claim scope', sub: 'its unknown names overall and references', style: 'reply', label: 'unknown_ids empty' },
  },
  {
    x: 330,
    hue: 'rose',
    dash: 'dashed',
    claims: [
      ['total-pseudocode', 'status fail, observed_status changed'],
      ['total-assembly', 'status fail, observed_status changed'],
    ],
    comparison: ['compare_functions ev_40ba96d8', ['left ev_a1fe53ff (ledger-arm64-O1)', 'right ev_bfe3275b (ledger-arm64-O2)']],
    tail: { hue: 'rose', title: 'unk_823f4184', sub: 'Function comparison is changed (medium)', style: 'fail', label: 'unknown_ids' },
  },
];

module.exports = figure('fig-7-1', {
  height: 392,
  title: 'Four claims over two comparison records',
  desc: 'A tree. The verification record ev_ccbaea4b at the top has status fail with two passed and two failed claims. Its left column holds the two percent_change claims, pseudocode and assembly, both pass with observed_status unchanged, pointing at the comparison record ev_2161e17a whose left side is ev_b492c85e from ledger-arm64-O1 and right side ev_142cc943 from ledger-arm64-O2. That comparison is unknown on references, and its residual unknown names only overall and references, so neither claim lists it. The right column holds the two total claims, both fail with observed_status changed, pointing at the comparison record ev_40ba96d8 with sides ev_a1fe53ff and ev_bfe3275b, which recorded the residual unknown unk_823f4184, Function comparison is changed.',
}, f => {
  const top = f.box({ x: 150, y: 14, w: 340, h: 48, hue: 'blue', title: 'verify_reconstruction ev_ccbaea4b', sub: 'status fail: 2 passed, 2 failed, 0 unknown' });
  for (const column of columns) {
    const cx = column.x + 145;
    f.arrow(top.bottom(), [cx, 99], { style: 'call' });
    column.claims.forEach(([title, sub], index) => {
      f.box({ x: column.x, y: 100 + index * 52, w: 290, h: 44, hue: column.hue, dash: column.dash, title, sub, titleSize: 12 });
    });
    f.arrow([cx, 196], [cx, 235], { style: 'call', label: 'comparison_evidence_id' });
    f.box({ x: column.x, y: 236, w: 290, h: 62, hue: 'teal', title: column.comparison[0], sub: column.comparison[1], titleSize: 12 });
    f.arrow([cx, 298], [cx, 333], { style: column.tail.style, label: column.tail.label });
    f.box({ x: column.x, y: 334, w: 290, h: 44, hue: column.tail.hue, dash: 'dashed', title: column.tail.title, sub: column.tail.sub, titleSize: 12 });
  }
});
