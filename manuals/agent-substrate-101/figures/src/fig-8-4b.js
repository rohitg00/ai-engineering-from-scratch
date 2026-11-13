'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const first = load(path.join(__dirname, '../../capture/lab/summary/upgrade-x86.json'));
const second = load(path.join(__dirname, '../../capture/lab/summary/upgrade-rerun-x86.json')).upgrade;
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

function steps(f, y, list, worker) {
  list.forEach((step, index) => {
    const label = labels[step.step];
    const x1 = px(step.begin_t);
    const x2 = Math.max(px(step.end_t === undefined ? step.begin_t + step.seconds : step.end_t), x1 + 3);
    const isWorker = label === '2' || label === '3';
    f.rect(x1, y, x2 - x1, 16, { fill: color(isWorker ? 'violet-ink' : 'blue-ink'), stroke: color('panel') });
    f.text((x1 + x2) / 2, index % 2 ? y - 5 : y + 29, label, { size: 11, weight: 700, anchor: 'middle', hue: isWorker ? 'violet' : 'blue' });
  });
  if (worker) {
    const x1 = px(worker.start);
    const x2 = px(worker.end);
    f.rect(x1, y, x2 - x1, 16, { hue: 'violet' });
    f.text((x1 + x2) / 2, y + 29, '3, the pool rolls', { size: 11, weight: 700, anchor: 'middle', hue: 'violet' });
  }
}

function rowLabel(f, y, top, bottom) {
  f.text(20, y + 4, top, { size: 11.5, serif: true, hue: 'ink' });
  if (bottom) f.text(20, y + 18, bottom, { size: 11.5, serif: true, hue: 'ink-soft' });
}

const cycles1 = first.suspend_resume_stream;
const running1 = first.running_actor;
const cycles2 = second.cycles;
const window2 = cycles2.windows[0];
const plain2 = second.running_actors['a-run'];
const trap2 = second.running_actors['a-term'];
const step4a = second.steps.find(step => step.step.startsWith('24a'));

module.exports = figure('fig-8-4b', {
  height: 488,
  title: 'Two upgrades from v1.0.0-rc.3 to v1.0.0, against the request streams',
  desc: `Two timelines of the same upgrade on one kind node, run once each. In the first run the loop actor failed ${cycles1.failed} of ${cycles1.cycles} suspend and resume cycles, all in the atelet step, and the RUNNING actor crashed when the worker image changed. In the second run the loop actor failed ${window2.cycles} cycles in a row in the atelet step, then crashed in the worker step and stayed crashed. The RUNNING actor that exits on SIGTERM crashed again, and the one that handles SIGTERM failed ${trap2.failed} of ${trap2.requests} requests.`,
}, f => {
  f.rect(20, 14, 12, 8, { fill: color('green-ink'), stroke: 'none' });
  f.text(38, 22, 'returned 200', { size: 11, hue: 'ink-soft' });
  f.rect(140, 14, 12, 8, { fill: color('rose-ink'), stroke: 'none' });
  f.text(158, 22, 'failed', { size: 11, hue: 'ink-soft' });
  f.rect(216, 12, 12, 12, { fill: color('blue-ink'), stroke: 'none' });
  f.text(234, 22, 'a control plane step', { size: 11, hue: 'ink-soft' });
  f.rect(390, 12, 12, 12, { fill: color('violet-ink'), stroke: 'none' });
  f.text(408, 22, 'a worker step', { size: 11, hue: 'ink-soft' });

  f.text(20, 58, 'First run', { size: 12.5, weight: 700, hue: 'ink' });
  rowLabel(f, 82, 'upgrade step');
  steps(f, 74, first.steps);
  const patch = first.steps.find(step => step.step.startsWith('23'));
  const next = first.steps.find(step => step.step.startsWith('24a'));
  f.text((px(patch.end_t) + px(next.begin_t)) / 2, 86, 'we watched the pool for 160 s', { size: 11, serif: true, anchor: 'middle', hue: 'ink-soft' });
  rowLabel(f, 136, 'suspend and resume,', 'one actor in a loop');
  band(f, 132, runs(cycles1.per_cycle.filter(item => item.t <= LAST), 3.5, item => item.ok));
  f.text(px(cycles1.first_failure_t), 125, `${cycles1.failed} cycles failed, in ${cycles1.failed_window_seconds.toFixed(0)} s of step 2`, { size: 11, serif: true, hue: 'rose' });
  rowLabel(f, 176, 'RUNNING actor that', 'exits on SIGTERM');
  band(f, 172, runs(running1.per_second.filter(item => item.t <= LAST), 1, item => item.code === '200'));
  f.text(px(running1.first_failure_t) + 4, 165, 'CRASHED after the image change, 503 until a revert', { size: 11, serif: true, hue: 'rose' });

  f.rule(20, 208, RIGHT, 208);
  f.text(20, 234, 'Second run', { size: 12.5, weight: 700, hue: 'ink' });
  rowLabel(f, 258, 'upgrade step');
  steps(f, 250, second.steps, { start: second.pool_patch_t, end: step4a.begin_t });
  rowLabel(f, 314, 'suspend and resume,', 'one actor in a loop');
  band(f, 310, runs(cycles2.per_cycle.filter(item => item.t <= LAST), 3.5, item => item.ok));
  f.text(px(window2.first_t), 303, `${window2.cycles} failed in ${(window2.next_ok_t - window2.first_t).toFixed(0)} s of step 2`, { size: 11, serif: true, hue: 'rose' });
  f.text(RIGHT, 303, 'then CRASHED until a revert', { size: 11, serif: true, hue: 'rose', anchor: 'end' });
  rowLabel(f, 354, 'RUNNING actor that', 'exits on SIGTERM');
  band(f, 350, runs(plain2.per_second.filter(item => item.t <= LAST), 1, item => item.code === '200'));
  f.text(px(second.pool_patch_t + plain2.first_failure_seconds_after_pool_patch) + 4, 343, `${plain2.failed} of ${plain2.requests} failed, CRASHED until a revert`, { size: 11, serif: true, hue: 'rose' });
  rowLabel(f, 394, 'RUNNING actor that', 'handles SIGTERM');
  band(f, 390, runs(trap2.per_second.filter(item => item.t <= LAST), 1, item => item.code === '200'));
  f.text(px(120), 383, `${trap2.failed} of ${trap2.requests} failed`, { size: 11, serif: true, hue: 'green' });

  f.rule(px(0), 428, px(LAST), 428, { hue: 'ink' });
  for (const t of [0, 60, 120, 180, 240, 300]) {
    f.rule(px(t), 424, px(t), 432, { hue: 'ink' });
    f.text(px(t), 446, `${t} s`, { size: 11, anchor: 'middle', hue: 'ink-soft' });
  }
  f.text((px(0) + px(LAST)) / 2, 470, 'seconds since the start of step 1', { size: 11.5, serif: true, anchor: 'middle', hue: 'ink-soft' });
});
