'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-2-1', {
  height: 300,
  title: 'The four states of a local sandbox',
  desc: 'Four states: absent, running, stopped, and removed. sbx create and sbx run move a sandbox from absent to running. sbx stop and the auto-stop of the daemon move it to stopped, and sbx run --name, sbx exec, and sbx ports move it back to running. sbx rm and sbx prune move a stopped sandbox to removed, and sbx rm --force or sbx run --rm move a running one there. The sandboxes named are m101-demo and m101-demo-2 from the capture.',
}, f => {
  const absent = f.box({ x: 20, y: 70, w: 120, h: 64, hue: 'grey', dash: 'dashed', title: 'absent', sub: ['no row in sbx ls'] });
  const running = f.box({ x: 240, y: 70, w: 140, h: 64, hue: 'amber', title: 'running', sub: ['m101-demo', 'm101-demo-2'] });
  const removed = f.box({ x: 500, y: 70, w: 120, h: 64, hue: 'grey', double: true, title: 'removed', sub: ['gone from sbx ls'] });
  const stopped = f.box({ x: 240, y: 210, w: 140, h: 64, hue: 'amber', dash: 'dashed', title: 'stopped', sub: ['state preserved'] });
  f.arrow(absent.right(), [running.x - 1, absent.cy], { style: 'state', label: 'sbx create', note: 'sbx run' });
  f.arrow(running.right(), [removed.x - 1, running.cy], { style: 'state', label: 'sbx rm --force', note: 'sbx run --rm' });
  f.arrow([262, running.y + running.h], [262, stopped.y - 1], { style: 'state', label: 'sbx stop', note: 'or auto-stop' });
  f.arrow([358, stopped.y], [358, running.y + running.h + 1], { style: 'state', label: 'sbx run --name', note: 'sbx exec, sbx ports' });
  f.path(`M${stopped.x + stopped.w} ${stopped.cy} H560 V${removed.y + removed.h + 1}`, { style: 'state' });
  f.text(470, stopped.cy - 6, 'sbx rm', { size: 11.5, hue: 'amber', anchor: 'middle', knock: true });
  f.text(470, stopped.cy + 15, 'sbx prune, stopped only', { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle', knock: true });
  f.text(20, 292, 'dashed border: no microVM running · double border: no record remains', { size: 11, serif: true, hue: 'ink-soft' });
});
