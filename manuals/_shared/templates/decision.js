'use strict';

const { figure } = require('../figkit.js');

module.exports = figure('tpl-decision', {
  height: 272,
  title: 'Where a failure happens decides its outcome',
  desc: 'Five phases run left to right: validate, prepare, store, apply and publish. A failure in validate or prepare rolls back, a refusal inside store is rejected, and an uncertain store result or a failed apply poisons the process. The bottom row says what to do next in each case.',
}, f => {
  f.kicker(20, 18, 'Where it fails');
  const phases = [['validate', 'bad input'], ['prepare', 'owners, ids'], ['store', 'the backend'], ['apply', 'memory state'], ['publish', 'observers']];
  phases.forEach(([title, sub], index) => f.box({ x: 20 + index * 120, y: 26, w: 110, h: 46, hue: index === 2 ? 'teal' : 'grey', title, sub }));
  f.box({ x: 20, y: 118, w: 230, h: 54, hue: 'teal', title: 'rolled back', sub: 'nothing stored, nothing shown' });
  f.box({ x: 260, y: 118, w: 110, h: 54, hue: 'teal', title: 'rejected', sub: 'refused, safe' });
  f.box({ x: 380, y: 118, w: 230, h: 54, hue: 'rose', title: 'poisoned', sub: 'outcome unknown, stop' });
  f.arrow([75, 72], [75, 117], { style: 'call' });
  f.arrow([195, 72], [195, 117], { style: 'call' });
  f.arrow([300, 72], [300, 117], { style: 'call' });
  f.path('M330 72 V94 H420 V117', { style: 'fail' });
  f.arrow([435, 72], [435, 117], { style: 'fail' });
  f.box({ x: 20, y: 212, w: 350, h: 48, hue: 'grey', title: 'carry on', sub: 'the next commit runs normally' });
  f.box({ x: 380, y: 212, w: 230, h: 48, hue: 'grey', title: 'reopen', sub: 'close, then open again' });
  f.arrow([135, 172], [135, 211], { style: 'reply' });
  f.arrow([315, 172], [315, 211], { style: 'reply' });
  f.arrow([495, 172], [495, 211], { style: 'reply' });
});
