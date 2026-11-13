'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/agent-executor-second-x86.json'));
const flight = data.worker_loss_in_flight;
const short = state => state.replace('SNAPSHOT_STORAGE_STATE_', '');
const two = value => value.toFixed(2);
const rows = [
  { run: flight.snapshot_pending, label: 'Run 3,' },
  { run: flight.snapshot_durable, label: 'Run 4,' },
];
const LEFT = 168;
const RIGHT = 388;
const FIRST = -8;
const LAST = 2.5;
const px = t => LEFT + (t - FIRST) * (RIGHT - LEFT) / (LAST - FIRST);
const TOP = 50;
const STEP = 58;

module.exports = figure('fig-7-5d', {
  height: TOP + STEP * rows.length + 64,
  title: 'An open ax ssh command when the worker pod is deleted',
  desc: `Two runs, one row each. In each run an ax ssh command printed one line each second, and the worker pod of the task was deleted after ${rows[0].run.ticks_received} lines. The command ended with an error ${two(rows[0].run.stream_ended_after_delete_seconds)} seconds after the delete in the first run and ${two(rows[1].run.stream_ended_after_delete_seconds)} seconds after it in the second. The actor was seen as CRASHED after ${rows[0].run.crashed_seen_after_seconds} and ${rows[1].run.crashed_seen_after_seconds} seconds. Nothing started the command again. After ax resume task, the file that the command had written was gone in both runs. The note from before the last suspend was gone in the first run, where the snapshot was ${short(rows[0].run.durable_snapshot_at_last_suspend)}, and kept in the second, where it was ${short(rows[1].run.durable_snapshot_at_last_suspend)}.`,
}, f => {
  f.rect(20, 14, 4, 10, { fill: color('green-ink'), stroke: 'none' });
  f.text(30, 23, 'one line from the command', { size: 11, hue: 'ink-soft' });
  f.rect(214, 14, 4, 10, { fill: color('rose-ink'), stroke: 'none' });
  f.text(224, 23, 'the command ends with an error', { size: 11, hue: 'ink-soft' });
  f.rule(440, 12, 440, 26, { hue: 'ink', dash: 'dashed' });
  f.text(448, 23, 'actor seen as CRASHED', { size: 11, hue: 'ink-soft' });

  rows.forEach((row, index) => {
    const y = TOP + index * STEP;
    const run = row.run;
    f.text(20, y + 12, row.label, { size: 11.5, serif: true, hue: 'ink' });
    f.text(20, y + 27, `last suspend ${Math.round(run.suspend_to_loss_seconds)} s before`, { size: 11.5, serif: true, hue: 'ink-soft' });
    f.rule(px(FIRST), y + 30, px(LAST), y + 30, { hue: 'ink-soft' });
    for (const t of run.tick_seconds_from_delete) f.rect(px(t) - 1.5, y + 6, 3, 14, { fill: color('green-ink'), stroke: 'none' });
    f.rect(px(run.stream_ended_after_delete_seconds) - 1.5, y + 2, 3, 22, { fill: color('rose-ink'), stroke: 'none' });
    f.rule(px(run.crashed_seen_after_seconds), y - 2, px(run.crashed_seen_after_seconds), y + 34, { hue: 'ink', dash: 'dashed' });
    const kept = run.file_from_before_last_suspend_kept;
    f.text(RIGHT + 14, y + 12, `error after ${two(run.stream_ended_after_delete_seconds)} s, no retry`, { size: 11, weight: 700, hue: 'rose' });
    f.text(RIGHT + 14, y + 27, `${short(run.durable_snapshot_at_last_suspend)}: note ${kept ? 'kept' : 'lost'}, new file lost`, { size: 11, serif: true, hue: 'ink-soft' });
  });

  const axis = TOP + rows.length * STEP + 6;
  f.rule(px(FIRST), axis, px(LAST), axis, { hue: 'ink' });
  for (const t of [-6, -4, -2, 0, 2]) {
    f.rule(px(t), axis - 4, px(t), axis + 4, { hue: 'ink' });
    f.text(px(t), axis + 18, `${t} s`, { size: 11, anchor: 'middle', hue: 'ink-soft' });
  }
  f.text((px(FIRST) + px(LAST)) / 2, axis + 38, 'seconds since the delete of the worker pod', { size: 11.5, serif: true, anchor: 'middle', hue: 'ink-soft' });
});
