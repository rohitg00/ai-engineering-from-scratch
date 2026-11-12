'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const upgrade = load(path.join(__dirname, '../../capture/lab/summary/upgrade-x86.json'));
const labels = {
  '21-step1-podcertificate-controller': '1',
  '22-step2-atelet': '2',
  '23-step3-workerpool-image-patch': '3',
  '24a-step4a-apiserver': '4a',
  '24b-step4b-ate-controller': '4b',
  '24c-step4c-atenet': '4c',
  '24d-step4d-sandboxconfig': '4d',
  '24e-step4e-ate-system': '4e',
};
const LEFT = 170;
const RIGHT = 620;
const LAST = 350;
const px = t => LEFT + Math.min(Math.max(t, 0), LAST) * (RIGHT - LEFT) / LAST;
const cycles = upgrade.suspend_resume_stream;
const running = upgrade.running_actor;

function runs(points, span, ok) {
  const out = [];
  points.forEach((point, index) => {
    const next = points[index + 1];
    const end = next ? next.t : point.t + span;
    const last = out[out.length - 1];
    if (last && last.ok === ok(point)) last.end = end;
    else out.push({ start: point.t, end, ok: ok(point) });
  });
  return out;
}

function band(f, y, items) {
  for (const run of items) {
    const x1 = px(run.start);
    const x2 = px(run.end);
    if (x2 - x1 < 0.5) continue;
    f.rect(x1, y, x2 - x1, 12, { fill: color(run.ok ? 'green-ink' : 'rose-ink'), stroke: 'none' });
  }
}

module.exports = figure('fig-8-4b', {
  height: 300,
  title: 'One upgrade from v1.0.0-rc.3 to v1.0.0, against two request streams',
  desc: `A timeline of one upgrade on one kind node, ${upgrade.first_step_begin_to_last_step_end_seconds} seconds from the start of step 1 to the end of step 4e. An actor that was suspended and resumed in a loop failed ${cycles.failed} of ${cycles.cycles} cycles, all during step 2, the atelet step. An actor that was RUNNING answered 503 from ${running.first_failure_t} seconds, about one second after the worker image changed in step 3, and stayed crashed.`,
}, f => {
  f.rect(20, 14, 12, 8, { fill: color('green-ink'), stroke: 'none' });
  f.text(38, 22, 'returned 200', { size: 11, hue: 'ink-soft' });
  f.rect(150, 14, 12, 8, { fill: color('rose-ink'), stroke: 'none' });
  f.text(168, 22, 'failed', { size: 11, hue: 'ink-soft' });
  f.rect(236, 12, 12, 12, { fill: color('blue-ink'), stroke: 'none' });
  f.text(254, 22, 'a control plane step runs', { size: 11, hue: 'ink-soft' });
  f.rect(446, 12, 12, 12, { fill: color('violet-ink'), stroke: 'none' });
  f.text(464, 22, 'a worker step runs', { size: 11, hue: 'ink-soft' });

  f.text(20, 72, 'upgrade step', { size: 11.5, serif: true, hue: 'ink' });
  upgrade.steps.forEach((step, index) => {
    const worker = step.step.startsWith('22') || step.step.startsWith('23');
    const label = labels[step.step];
    const x1 = px(step.begin_t);
    const x2 = Math.max(px(step.end_t), x1 + 3);
    f.rect(x1, 58, x2 - x1, 22, { fill: color(worker ? 'violet-ink' : 'blue-ink'), stroke: color('panel') });
    f.text((x1 + x2) / 2 + (label === '3' ? 9 : 0), index % 2 || label === '3' ? 50 : 96, label, { size: 11, weight: 700, anchor: 'middle', hue: worker ? 'violet' : 'blue' });
  });
  const patch = upgrade.steps.find(step => step.step.startsWith('23'));
  const next = upgrade.steps.find(step => step.step.startsWith('24a'));
  f.text((px(patch.end_t) + px(next.begin_t)) / 2, 73, 'we watched the pool for 160 s', { size: 11, serif: true, anchor: 'middle', hue: 'ink-soft' });

  f.text(20, 136, 'suspend and resume,', { size: 11.5, serif: true, hue: 'ink' });
  f.text(20, 151, 'one actor in a loop', { size: 11.5, serif: true, hue: 'ink-soft' });
  band(f, 132, runs(cycles.per_cycle.filter(item => item.t <= LAST), 3.5, item => item.ok));
  f.text(px(cycles.first_failure_t), 124, `${cycles.failed} of ${cycles.cycles} cycles failed, in ${cycles.failed_window_seconds.toFixed(0)} s of step 2`, { size: 11, serif: true, hue: 'rose' });

  f.text(20, 196, 'one request each second', { size: 11.5, serif: true, hue: 'ink' });
  f.text(20, 211, 'to a RUNNING actor', { size: 11.5, serif: true, hue: 'ink-soft' });
  band(f, 192, runs(running.per_second.filter(item => item.t <= LAST), 1, item => item.code === '200'));
  f.text(px(running.first_failure_t) + 4, 184, 'CRASHED after the image change, 503 until a revert', { size: 11, serif: true, hue: 'rose' });

  f.rule(px(0), 244, px(LAST), 244, { hue: 'ink' });
  for (const t of [0, 60, 120, 180, 240, 300]) {
    f.rule(px(t), 240, px(t), 248, { hue: 'ink' });
    f.text(px(t), 262, `${t} s`, { size: 11, anchor: 'middle', hue: 'ink-soft' });
  }
  f.text((px(0) + px(LAST)) / 2, 284, 'seconds since the start of step 1', { size: 11.5, serif: true, anchor: 'middle', hue: 'ink-soft' });
});
