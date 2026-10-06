'use strict';

const { figure, color } = require('../figkit.js');

module.exports = figure('tpl-layers', {
  height: 362,
  title: 'The layers of a library',
  desc: 'A host application on top calls a library made of four components; every change goes through one kernel queue, which writes to one of three storage backends. Options plugged in by the host sit in a column on the right.',
}, f => {
  f.kicker(20, 18, 'Your process');
  f.box({ x: 20, y: 26, w: 440, h: 42, hue: 'grey', title: 'Host application', sub: 'open() · submit() · watch() · close()' });
  f.kicker(20, 96, 'Library · src/core');
  f.rect(20, 104, 440, 110, { fill: color('paper'), stroke: color('ink-mute') });
  const components = [['Sessions', 'submit, fork', 'blue'], ['Requests', 'admission', 'violet'], ['Scheduler', 'runs tasks', 'amber'], ['Views', 'watch()', 'indigo']];
  components.forEach(([title, sub, hue], index) => f.box({ x: 32 + index * 106, y: 116, w: 98, h: 50, hue, title, sub, pad: 8 }));
  f.box({ x: 32, y: 176, w: 416, h: 28, hue: 'amber', title: 'built-in tasks: generate · tool · compact', titleSize: 11.5, weight: 400 });
  f.arrow([240, 68], [240, 103], { style: 'call' });
  f.kicker(20, 242, 'Kernel');
  f.box({ x: 20, y: 250, w: 440, h: 34, hue: 'teal', title: 'one write queue · transactions · trackers' });
  f.arrow([240, 214], [240, 249], { style: 'write', label: 'every change is a commit' });
  f.kicker(20, 312, 'Storage · one per process');
  [['MemoryStore', 'nothing persisted'], ['SqliteStore', 'one database file'], ['JsonlStore', 'files in a folder']].forEach(([title, sub], index) => f.box({ x: 20 + index * 150, y: 320, w: 140, h: 36, hue: 'teal', title, sub, titleSize: 12 }));
  f.arrow([240, 284], [240, 319], { style: 'write' });
  f.kicker(480, 96, 'Options');
  [['registry', 'tools, hooks', 104], ['models', 'provider API', 158], ['env', 'builds an env', 212]].forEach(([title, sub, y]) => {
    f.box({ x: 480, y, w: 140, h: 44, hue: 'grey', title, sub });
    f.rule(460, y + 22, 480, y + 22, { dash: 'dashed' });
  });
});
