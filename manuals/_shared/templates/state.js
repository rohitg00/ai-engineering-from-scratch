'use strict';

const { figure } = require('../figkit.js');

module.exports = figure('tpl-state', {
  height: 262,
  title: 'A task as a state machine',
  desc: 'A task moves from pending to running. From running it can pause in waiting and come back, or end in one of three terminal states: completed, failed or canceled. Terminal states have a double border and interrupted states a dashed one.',
}, f => {
  f.kicker(20, 82, 'Live');
  f.kicker(470, 18, 'Terminal');
  f.box({ x: 20, y: 100, w: 124, h: 40, hue: 'amber', title: 'pending' });
  f.box({ x: 180, y: 100, w: 124, h: 40, hue: 'amber', title: 'running' });
  f.box({ x: 180, y: 196, w: 124, h: 40, hue: 'amber', title: 'waiting', dash: 'dashed' });
  f.box({ x: 470, y: 30, w: 150, h: 40, hue: 'green', title: 'completed', double: true });
  f.box({ x: 470, y: 100, w: 150, h: 40, hue: 'rose', title: 'failed', double: true });
  f.box({ x: 470, y: 170, w: 150, h: 40, hue: 'grey', title: 'canceled', double: true });
  f.arrow([144, 120], [179, 120], { style: 'state' });
  f.text(162, 94, 'reserve', { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });
  f.path('M304 120 H380', { style: 'state', head: false });
  f.path('M380 120 V50 H469', { style: 'state' });
  f.path('M380 120 H469', { style: 'state' });
  f.path('M380 120 V190 H469', { style: 'state' });
  f.text(430, 44, 'ok', { size: 11.5, hue: 'amber', anchor: 'middle' });
  f.text(430, 114, 'error', { size: 11.5, hue: 'amber', anchor: 'middle' });
  f.text(430, 184, 'abort', { size: 11.5, hue: 'amber', anchor: 'middle' });
  f.line(212, 140, 212, 195, { style: 'state' });
  f.line(272, 196, 272, 141, { style: 'state' });
  f.text(204, 172, 'needs input', { size: 11, serif: true, hue: 'ink-soft', anchor: 'end' });
  f.text(280, 172, 'input arrives', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 256, 'double border: terminal · dashed border: interrupted', { size: 11, serif: true, hue: 'ink-soft' });
});
