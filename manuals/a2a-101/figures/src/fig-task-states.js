'use strict';

const { figure } = require('../../../_shared/figkit.js');

const note = (f, x, y, content, anchor) => f.text(x, y, content, { size: 11, serif: true, hue: 'ink-soft', anchor });

module.exports = figure('fig-task-states', {
  height: 448,
  title: 'The nine task states and the transitions the kit makes',
  desc: 'Nine TaskState values without their TASK_STATE_ prefix, and the transitions the kit makes in capture order. SUBMITTED goes to WORKING in 05, and WORKING ends in COMPLETED in 03 and 05. SUBMITTED goes to INPUT_REQUIRED when the reviewer asks a question in 06, and INPUT_REQUIRED returns to WORKING when the client answers. WORKING goes to AUTH_REQUIRED and back when an operator approves in 07. SUBMITTED goes to REJECTED when the deployer refuses production in 08. WORKING ends in FAILED for a missing commit in 09, and in CANCELED after CancelTask in 10. The four terminal states have double borders and no outgoing arrows. UNSPECIFIED, value 0, stands apart and is never sent by the kit.',
}, f => {
  const auth = f.box({ x: 20, y: 56, w: 140, h: 42, hue: 'amber', dash: 'dashed', title: 'AUTH_REQUIRED', sub: 'value 8' });
  const submitted = f.box({ x: 20, y: 168, w: 140, h: 42, hue: 'amber', title: 'SUBMITTED', sub: 'value 1' });
  const working = f.box({ x: 250, y: 168, w: 140, h: 42, hue: 'amber', title: 'WORKING', sub: 'value 2' });
  const input = f.box({ x: 250, y: 290, w: 140, h: 42, hue: 'amber', dash: 'dashed', title: 'INPUT_REQUIRED', sub: 'value 6' });
  f.kicker(470, 12, 'Terminal');
  const completed = f.box({ x: 470, y: 20, w: 150, h: 54, hue: 'amber', double: true, title: 'COMPLETED', sub: ['value 3', 'in 03 05 06 07'] });
  const failed = f.box({ x: 470, y: 92, w: 150, h: 54, hue: 'rose', double: true, title: 'FAILED', sub: ['value 4', 'commit missing, in 09'] });
  const canceled = f.box({ x: 470, y: 162, w: 150, h: 54, hue: 'rose', double: true, title: 'CANCELED', sub: ['value 5', 'CancelTask, in 10'] });
  const rejected = f.box({ x: 470, y: 324, w: 150, h: 54, hue: 'rose', double: true, title: 'REJECTED', sub: ['value 7', 'in 08'] });
  f.box({ x: 20, y: 396, w: 140, h: 42, hue: 'grey', title: 'UNSPECIFIED', sub: 'value 0, unused' });
  note(f, 176, 414, 'Prefix TASK_STATE_ dropped from every name.', 'start');
  note(f, 176, 430, 'Dashed border: interrupted. Double border: terminal.', 'start');

  const branch = target => f.path(`M430 ${working.cy} V${target.cy} H${target.x - 1}`, { style: 'state' });

  f.beat(1);
  f.arrow([submitted.x + submitted.w, submitted.cy], [working.x - 1, working.cy], { style: 'state' });
  note(f, 205, 183, 'starts (05)', 'middle');

  f.beat(2);
  f.path(`M${working.x + working.w} ${working.cy} H430`, { style: 'state', head: false });
  branch(completed);

  f.beat(3);
  f.path(`M90 ${submitted.y + submitted.h} V${input.cy} H${input.x - 1}`, { style: 'state' });
  note(f, 170, input.cy - 6, 'asks for a branch (06)', 'middle');

  f.beat(4);
  f.line(320, input.y, 320, working.y + working.h + 1, { style: 'state' });
  note(f, 328, 255, 'client answers (06)', 'start');

  f.beat(5);
  f.path(`M360 ${working.y} V${auth.cy} H${auth.x + auth.w + 1}`, { style: 'state' });
  note(f, 260, auth.cy - 6, 'needs approval (07)', 'middle');

  f.beat(6);
  f.path(`M90 ${auth.y + auth.h} V138 H300 V${working.y - 1}`, { style: 'state' });
  note(f, 195, 132, 'operator approves (07)', 'middle');

  f.beat(7);
  f.path(`M50 ${submitted.y + submitted.h} V${rejected.cy} H${rejected.x - 1}`, { style: 'state' });
  note(f, 170, rejected.cy - 6, 'refuses production (08)', 'middle');

  f.beat(8);
  branch(failed);

  f.beat(9);
  branch(canceled);
});
