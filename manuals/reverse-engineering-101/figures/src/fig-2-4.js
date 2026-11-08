'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

const columns = [
  { title: 'ghidra', sub: ['30 operations', 'available'], hue: 'violet' },
  { title: 'hopper', sub: ['37 operations', 'unavailable'], hue: 'grey' },
  { title: 'ida', sub: ['13 operations', 'unavailable'], hue: 'grey' },
  { title: 'kuna', sub: ['13 operations', 'unavailable'], hue: 'grey' },
  { title: 'target-free', sub: ['19 operations', 'no binding'], hue: 'blue' },
];
const rows = [
  ['launches_process', ['30 of 30', '37 of 37', '0', '13 of 13', '12 of 19']],
  ['may_write_filesystem', ['30 of 30', '6 of 37', '0', '13 of 13', '6 of 19']],
  ['may_show_ui', ['0', '37 of 37', '4 of 13', '0', '2 of 19']],
  ['may_access_network', ['0', '0', '13 of 13', '0', '2 of 19']],
  ['mutates_artifact', ['3 of 30', '6 of 37', '0', '0', '0']],
  ['changes_permissions', ['0', '0', '0', '0', '0']],
  ['requires_root', ['0', '0', '0', '0', '0']],
];
const colX = index => 166 + index * 91;

module.exports = figure('fig-2-4', {
  height: 330,
  title: 'Declared effects by provider in the capture',
  desc: 'A table with five columns, ghidra with 30 operations available, hopper with 37 operations unavailable, ida with 13 operations unavailable, kuna with 13 operations unavailable, and 19 target-free operations with no provider binding, and seven rows, one per effect flag. launches_process is true for 30 of 30 ghidra operations, 37 of 37 hopper operations, no ida operation, 13 of 13 kuna operations, and 12 of 19 target-free operations. may_write_filesystem is true for 30 of 30, 6 of 37, 0, 13 of 13, and 6 of 19. may_show_ui is true for 0, 37 of 37, 4 of 13, 0, and 2 of 19. may_access_network is true for 0, 0, 13 of 13, 0, and 2 of 19. mutates_artifact is true for 3 of 30, 6 of 37, 0, 0, and 0. changes_permissions and requires_root are false everywhere.',
}, f => {
  f.kicker(20, 18, 'effect flag');
  columns.forEach((column, index) => f.box({ x: colX(index), y: 26, w: 88, h: 56, titleSize: 12, pad: 4, ...column }));
  rows.forEach(([flag, values], row) => {
    const y = 92 + row * 32;
    f.rect(20, y, 142, 32, { fill: color('paper'), stroke: color('panel-edge') });
    f.text(26, y + 20, flag, { size: 11 });
    values.forEach((value, index) => {
      const zero = value === '0';
      f.rect(colX(index), y, 88, 32, { fill: zero ? color('paper') : color(`${columns[index].hue}-fill`), stroke: color('panel-edge') });
      f.text(colX(index) + 44, y + 20, value, { size: 12, anchor: 'middle', hue: zero ? 'ink-mute' : undefined });
    });
  });
});
