'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

const columns = [
  { x: 160, name: 'planner', sub: 'first message', hue: 'violet' },
  { x: 256, name: 'code-reviewer', sub: 'its question', hue: 'blue' },
  { x: 352, name: 'planner', sub: 'the answer', hue: 'violet' },
];
const width = 96;
const rows = [
  ['messageId', true, ['14a03569', '46494a30', '096d3737'], ['minted by the sender', 'for every message']],
  ['contextId', false, [null, '49c5a238', '49c5a238'], ['minted by the server,', 'echoed by the client']],
  ['taskId', false, [null, 'e5c95b09', 'e5c95b09'], ['minted by the server,', 'echoed to continue a task']],
  ['role', true, ['ROLE_USER', 'ROLE_AGENT', 'ROLE_USER'], ['the direction:', 'client to server is USER']],
  ['parts', true, ['text, raw', 'text', 'text "main"'], ['the sender, at least', 'one part']],
];
const optional = [
  ['metadata', 'the sender: a JSON object'],
  ['extensions', 'the sender: extension URIs'],
  ['referenceTaskIds', 'the sender: related tasks'],
];
const ROW = 34;
const TOP = 48;

module.exports = figure('fig-message-fields', {
  height: 384,
  title: 'Who sets each field of a message',
  desc: 'A table of the eight Message fields across three messages of the review in 06-input-required.http, which appear one column at a time in the order they were sent. The planner first message 14a03569 has no contextId and no taskId. The code-reviewer question 46494a30 carries contextId 49c5a238 and taskId e5c95b09. The planner answer 096d3737 echoes both ids. Roles are ROLE_USER, ROLE_AGENT and ROLE_USER. metadata, extensions and referenceTaskIds are not set in any of them. A right column says who sets each field, and a last note says the server writes both ids into its stored copy of the first message.',
}, f => {
  f.kicker(28, 34, 'field');
  f.kicker(452, 34, 'who sets it');
  let y = TOP;
  for (const [field, required, , who] of rows) {
    f.rect(20, y, 600, ROW, { fill: color('paper'), stroke: color('panel-edge') });
    if (required) f.dot(30, y + 17, { r: 3, hue: 'blue' });
    f.text(40, y + 21, field, { size: 12, weight: required ? 700 : undefined });
    who.forEach((line, index) => f.text(452, y + 14 + index * 14, line, { size: 11, serif: true, hue: 'ink-soft' }));
    y += ROW;
  }
  const requiredEnd = y;
  for (const [field, who] of optional) {
    f.rect(20, y, 600, 28, { fill: color('paper'), stroke: color('ink-mute'), dash: 'dashed' });
    f.text(40, y + 18, field, { size: 12, hue: 'ink-mute' });
    f.text(304, y + 18, 'not set in any kit capture', { size: 11, serif: true, hue: 'ink-mute', anchor: 'middle' });
    f.text(452, y + 18, who, { size: 11, serif: true, hue: 'ink-soft' });
    y += 28;
  }
  for (const column of columns) f.rule(column.x, TOP, column.x, requiredEnd, { hue: 'panel-edge' });
  f.rule(448, TOP, 448, requiredEnd, { hue: 'panel-edge' });
  const noteY = y + 14;
  f.dot(30, noteY + 48, { r: 3, hue: 'blue' });
  f.text(40, noteY + 52, 'REQUIRED in proto Message', { size: 11, serif: true, hue: 'ink-soft' });

  columns.forEach((column, columnIndex) => {
    f.beat(columnIndex + 1);
    f.rect(column.x, 10, width, 38, { hue: column.hue });
    f.text(column.x + width / 2, 27, column.name, { size: 11.5, weight: 700, anchor: 'middle' });
    f.text(column.x + width / 2, 42, column.sub, { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });
    const cx = column.x + width / 2;
    rows.forEach(([, , values], rowIndex) => {
      const value = values[columnIndex];
      const ty = TOP + rowIndex * ROW + 21;
      if (value === null) f.text(cx, ty, 'omitted', { size: 11, serif: true, hue: 'ink-mute', anchor: 'middle' });
      else f.text(cx, ty, value, { size: 11, anchor: 'middle' });
    });
  });

  f.beat(4);
  f.text(20, noteY + 12, 'The server writes contextId 49c5a238 and taskId e5c95b09 into its stored copy', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, noteY + 27, 'of the first message, which the planner sent without them.', { size: 11, serif: true, hue: 'ink-soft' });
});
