'use strict';

const { figure } = require('../../../_shared/figkit.js');

const rows = [
  [['the pause'], ['one interrupt', 'action_requests for all calls', 'blue'], ['one interrupt per call', 'type tool_approval, a schema', 'blue']],
  [['the resume'], ['a list of decisions', 'in the order of the calls', 'blue'], ['a map of id to decision', 'checked by response_schema', 'blue']],
  [['an edit to', 'another tool'], ['delete_file ran', 'B3, 3 of 3 runs', 'rose'], ['ValidationError', 'P3, nothing ran, 3 of 3', 'blue']],
  [['a middleware', 'jumps to tools'], ['the tool ran anyway', 'J1, J2, J3, 3 of 3 runs', 'rose'], ['the review held', 'J4, J5, nothing ran', 'blue']],
];

module.exports = figure('fig-5-5', {
  height: 318,
  title: 'Batched mode and per-call mode',
  desc: 'A table of four rows and two columns, batched mode on the left and per-call mode on the right. The pause: one interrupt with action requests for all calls, against one interrupt per call of type tool_approval with a schema. The resume: a list of decisions in the order of the calls, against a map of interrupt id to decision checked by response_schema. An edit to another tool: in batched case B3 delete_file ran in 3 of 3 runs, and in per-call case P3 a ValidationError meant nothing ran. A middleware that jumps to tools: in batched cases J1 to J3 the tool ran anyway, and in per-call cases J4 and J5 the review held.',
}, f => {
  f.kicker(188, 20, 'batched');
  f.kicker(408, 20, 'per call');
  rows.forEach(([label, left, right], i) => {
    const y = 34 + i * 70;
    label.forEach((line, k) => f.text(20, y + 22 + k * 15 - (label.length - 1) * 7, line, { size: 11.5, weight: 700, max: 160 }));
    f.box({ x: 188, y, w: 208, h: 50, hue: left[2], title: left[0], sub: left[1], align: 'left', titleSize: 12 });
    f.box({ x: 408, y, w: 212, h: 50, hue: right[2], title: right[0], sub: right[1], align: 'left', titleSize: 12 });
  });
  f.text(20, 312, 'Rows 1 and 2 are from the capture kit. Rows 3 and 4 are lab runs on the Mac.', { size: 11, serif: true, hue: 'ink-soft' });
});
