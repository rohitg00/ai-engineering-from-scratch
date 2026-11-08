'use strict';

const { figure } = require('../../../_shared/figkit.js');

const calls = [
  { title: 'list_procedures', sub: '6,349 ms', evidence: 'ev_3c6350b2', found: '13 procedures' },
  { title: 'list_strings', sub: '6 ms', evidence: 'ev_ad37f574', found: '39 strings, F to A' },
  { title: 'analyze_function', sub: '_grade, 16 ms', evidence: 'ev_41e8ca1c', found: '15 instructions' },
  { title: 'analyze_function', sub: '_grade_label, 18 ms', evidence: 'ev_b201cfd0', found: 'names _labels' },
];

module.exports = figure('fig-8-3', {
  height: 378,
  title: 'From one question to a ledger',
  desc: 'A flow read top down. The question in plum: what does ledger print for a score of 95, and where does the letter come from. Four MCP calls in indigo: list_procedures in 6,349 ms, list_strings in 6 ms, analyze_function on _grade in 16 ms, and analyze_function on _grade_label in 18 ms. Four Evidence records in teal: ev_3c6350b2 with 13 procedures, ev_ad37f574 with 39 strings from F to A, ev_41e8ca1c with 15 instructions and no caller, and ev_b201cfd0 naming _labels and DAT_1000007e8. One amber ledger with one row per claim: observed 5, derived 2, inferred 1, unknown 1, refused 1. The answer in grey stays unknown until read_bytes runs at 0x1000007d0 and 0x1000007e8.',
}, f => {
  const question = f.box({ x: 20, y: 14, w: 600, h: 44, hue: 'plum', title: 'the question', sub: 'what does ledger print for a score of 95, and where does the letter come from?' });
  calls.forEach((call, index) => {
    const x = 20 + index * 150;
    const cx = x + 73;
    f.arrow(question.bottom(), [cx, 89], { style: 'call' });
    f.box({ x, y: 90, w: 146, h: 44, hue: 'indigo', title: call.title, sub: call.sub, titleSize: 11 });
    f.arrow([cx, 134], [cx, 165], { style: 'reply' });
    f.box({ x, y: 166, w: 146, h: 44, hue: 'teal', title: call.evidence, sub: call.found, titleSize: 11 });
    f.arrow([cx, 210], [cx, 243], { style: 'write' });
  });
  const ledger = f.box({ x: 20, y: 244, w: 600, h: 44, hue: 'amber', title: 'the ledger, one row per claim', sub: 'observed 5, derived 2, inferred 1, unknown 1, refused 1' });
  f.arrow(ledger.bottom(), [320, 319], { style: 'reply', label: 'answer so far' });
  f.box({ x: 20, y: 320, w: 600, h: 44, hue: 'grey', dash: 'dashed', title: 'the answer', sub: 'unknown until read_bytes at 0x1000007d0 and 0x1000007e8' });
});
