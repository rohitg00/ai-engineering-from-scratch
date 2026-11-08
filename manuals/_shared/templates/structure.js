'use strict';

const { figure, color } = require('../figkit.js');

const rows = [
  ['id', '22', 'one id space for every record'],
  ['kind', '"tool"', null],
  ['status', '"running"', 'pending, running, waiting, done'],
  ['checkpoint', '{ phase: "execute" }', 'where a restart resumes'],
  ['owner', 'conversation 1', null],
  ['updated', 'seq 27', 'the commit that wrote this row'],
];

module.exports = figure('tpl-structure', {
  height: 226,
  title: 'Anatomy of one stored record',
  desc: 'A task record drawn as a table of six fields, id, kind, status, checkpoint, owner and updated, with notes on the right that say what four of the fields are for.',
}, f => {
  f.kicker(20, 18, 'One stored record');
  f.kicker(380, 18, 'What each field is for');
  f.box({ x: 20, y: 26, w: 330, h: 28, hue: 'amber', title: 'task 22', align: 'left' });
  rows.forEach(([field, value, note], index) => {
    const y = 54 + index * 28;
    f.rect(20, y, 330, 28, { fill: color('paper'), stroke: color('panel-edge') });
    f.text(32, y + 18, field, { size: 12, hue: 'ink-soft' });
    f.text(150, y + 18, value, { size: 12 });
    if (note) {
      f.rule(350, y + 14, 372, y + 14, { hue: 'amber' });
      f.text(380, y + 18, note, { size: 11, serif: true, hue: 'ink-soft' });
    }
  });
});
