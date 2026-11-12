'use strict';

const path = require('path');
const { figure } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/agent-executor-followups-x86.json'));
const one = value => value.toFixed(1);
const two = value => value.toFixed(2);
const pending = data.worker_loss.snapshot_pending;
const durable = data.worker_loss.snapshot_durable;
const short = state => state.replace('SNAPSHOT_STORAGE_STATE_', '');

const rows = [
  {
    run: pending,
    hue: 'rose',
    wait: [`${one(pending.suspend_to_loss_seconds)} s before the loss,`, 'still on the worker'],
    result: 'both files lost',
    cost: ['also the file that', 'the suspend saved'],
  },
  {
    run: durable,
    hue: 'green',
    wait: [`${Math.round(durable.suspend_to_loss_seconds)} s before the loss,`, `uploaded after ${Math.round(durable.durable_snapshot_completed_after_seconds)} s`],
    result: 'saved file kept',
    cost: ['a file written', 'after it is lost'],
  },
];

module.exports = figure('fig-7-5c', {
  height: 232,
  title: 'A worker pod is deleted under a running Agent Executor task',
  desc: `Two runs, one row each. In both, a task wrote one file, was suspended and resumed, wrote a second file, and then lost its worker pod. In the first run the suspend was ${one(pending.suspend_to_loss_seconds)} seconds before the loss and the snapshot was still ${short(pending.durable_snapshot_at_loss)}: after ax resume task, which took ${two(pending.ax_resume_seconds)} seconds, both files were gone. In the second run the suspend was ${Math.round(durable.suspend_to_loss_seconds)} seconds before the loss and the snapshot was ${short(durable.durable_snapshot_at_loss)} in the object store: ax resume task took ${two(durable.ax_resume_seconds)} seconds, the first file was kept, and the second file was gone. In both runs the task showed the phase ${pending.phase_after_loss} until the resume, and no revert command was needed.`,
}, f => {
  f.kicker(20, 18, 'Last suspend');
  f.kicker(184, 18, 'Worker pod deleted');
  f.kicker(348, 18, 'ax resume task');
  f.kicker(492, 18, 'In /workspace');
  rows.forEach((row, index) => {
    const y = 28 + index * 90;
    const run = row.run;
    const wait = f.box({ x: 20, y, w: 150, h: 72, hue: 'amber', align: 'left', pad: 8, title: short(run.durable_snapshot_at_loss), titleSize: 11.5, sub: row.wait });
    const loss = f.box({ x: 184, y, w: 150, h: 72, hue: 'rose', align: 'left', pad: 8, title: `CRASHED in ${one(run.crashed_seen_after_seconds)} s`, titleSize: 11.5, sub: [`Phase: ${run.phase_after_loss} for`, `${Math.round(run.watched_with_no_command_seconds)} s with no command`] });
    const resume = f.box({ x: 348, y, w: 130, h: 72, hue: 'blue', align: 'left', pad: 8, title: `RUNNING, ${two(run.ax_resume_seconds)} s`, titleSize: 11.5, sub: ['on another worker,', 'no revert from you'] });
    const result = f.box({ x: 492, y, w: 128, h: 72, hue: row.hue, align: 'left', pad: 8, title: row.result, titleSize: 11.5, sub: row.cost });
    f.arrow(wait.right(), [loss.x - 1, wait.cy], { style: 'state' });
    f.arrow(loss.right(), [resume.x - 1, loss.cy], { style: 'call' });
    f.arrow(resume.right(), [result.x - 1, resume.cy], { style: index ? 'state' : 'fail' });
  });
  f.text(20, 218, 'One run for each row, on one kind node with a pool of 2 workers. Each task ran sleep infinity.', { size: 11, serif: true, hue: 'ink-soft' });
});
