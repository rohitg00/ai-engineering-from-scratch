'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const tasks = load(path.join(__dirname, '../../capture/lab/summary/demos-x86.json')).tool_sandbox;
const names = ['download from the mirror', 'outside host, by name', 'outside host, by IP', 'Kubernetes API, by name', '2 s of CPU work', '640 MiB of memory'];
const results = ['file saved, exit 0', 'NXDOMAIN', '403 from the gateway', 'name not resolved', '2.38 s of wall time', '503, actor CRASHED'];
const good = [true, false, false, false, true, false];
const two = value => value.toFixed(2);

module.exports = figure('fig-9-3', {
  height: 336,
  title: 'Six tasks in one sandbox actor, each followed by a revert',
  desc: `Six rows for six commands sent to one sandbox actor on the second x86 server guest, with one egress rule for a package mirror, 500 millicores and 256 MiB. ${tasks.map((t, i) => `${names[i]}: ${results[i]}, revert in ${two(t.revert_seconds)} s, ${t.files_after_revert} files after it`).join('. ')}.`,
}, f => {
  f.kicker(16, 28, 'the command tries');
  f.kicker(232, 28, 'what it gets');
  f.kicker(420, 28, 'revert', { hue: 'amber' });
  f.kicker(506, 28, 'files in /work', { hue: 'green' });
  tasks.forEach((task, index) => {
    const y = 46 + index * 46;
    const hue = good[index] ? 'green' : 'rose';
    f.rule(16, y - 8, 624, y - 8, { hue: 'ink-mute', opacity: 0.25 });
    f.text(16, y + 14, names[index], { size: 12, weight: 700 });
    f.box({ x: 232, y, w: 168, h: 28, hue, title: results[index], titleSize: 11.5 });
    f.arrow([400, y + 14], [470, y + 14], { style: 'state' });
    f.text(420, y + 34, `${two(task.revert_seconds)} s`, { size: 11, hue: 'amber' });
    f.box({ x: 506, y, w: 60, h: 28, hue: 'green', title: String(task.files_after_revert), titleSize: 12 });
  });
});
