'use strict';

const fs = require('fs');
const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');

const events = fs.readFileSync(path.join(__dirname, '../../capture/lab/internals/01-superstep/trace.jsonl'), 'utf8')
  .trim().split('\n').map(line => JSON.parse(line));

const steps = [];
let current = null;
for (const e of events) {
  if (e.event === 'prepare_next_tasks' && e.for_execution) {
    current = { step: e.step, tasks: e.tasks, seen: e.versions_seen, changed: {}, written: new Set() };
    steps.push(current);
  } else if (e.event === 'apply_writes' && current) {
    current.changed = e.versions_changed;
    for (const w of e.writes_in_apply_order) current.written.add(w.channel);
  }
}
if (steps.length !== 6) throw new Error(`fig-2-1: expected 6 planned steps, got ${steps.length}`);

const CHANNELS = ['__start__', 'messages', 'branch:to:model', '__pregel_tasks'];
const versions = {};
for (const s of steps) {
  s.after = {};
  for (const ch of CHANNELS) {
    if (s.changed[ch]) versions[ch] = s.changed[ch][1];
    s.after[ch] = versions[ch];
  }
}
const seenModel = steps.map(s => (s.seen.model ? s.seen.model['branch:to:model'] : null));
const trig = steps[4].after['branch:to:model'];
const last = steps[5];
const lastBranch = last.step === 4 ? steps[4].after['branch:to:model'] : null;

const X0 = 150;
const CW = 78;
const colX = i => X0 + i * CW;
const TASK_Y = 40;
const ROW_Y = 104;
const RH = 30;
const rowY = r => ROW_Y + r * RH;

const label = t => {
  if (t.kind === '__pregel_push') return `${t.name}[${/\d+/.exec(t.path)[0]}]`;
  return t.name;
};

module.exports = figure('fig-2-1', {
  height: 430,
  title: 'Six supersteps of one create_agent run, with channel versions',
  desc: `A grid of the ${steps.length} planned supersteps of one create_agent run with two tool calls, from the input step ${steps[0].step} to step ${last.step}, which finds no task. The top row names the tasks planned in each step: __start__, model, two PUSH tasks of tools, model again, and none. Four rows below give the version of __start__, messages, branch:to:model, and __pregel_tasks after each step. A filled cell is a channel written in that step, a dashed cell is a channel cleared by its reader with a new version, and a plain grey number is a version carried over. Every channel that changes in one step gets the same number. Amber arrows run from the channel version that triggers a task to that task in the next step. The bottom row is the version of branch:to:model that model had seen. At step ${last.step} the channel is at version ${lastBranch} and model saw ${seenModel[5]}, but the channel is empty, so no task runs.`,
}, f => {
  f.kicker(20, 22, 'superstep');
  steps.forEach((s, i) => {
    f.text(colX(i) + 35, 22, String(s.step), { size: 12, weight: 700, anchor: 'middle', hue: 'amber' });
  });
  f.text(20, TASK_Y + 16, 'tasks planned', { size: 11.5, hue: 'amber' });
  f.text(20, TASK_Y + 32, 'PULL or PUSH', { size: 11, serif: true, hue: 'ink-soft' });
  CHANNELS.forEach((ch, r) => f.text(20, rowY(r) + 19, ch, { size: 11.5, hue: 'indigo' }));
  f.text(20, rowY(4) + 15, 'model had seen', { size: 11.5, hue: 'ink-soft' });
  f.text(20, rowY(4) + 29, 'branch:to:model', { size: 11, serif: true, hue: 'ink-soft' });
  f.rule(16, ROW_Y - 10, 620, ROW_Y - 10, { hue: 'ink-mute', opacity: 0.4 });
  f.rule(16, rowY(4) - 4, 620, rowY(4) - 4, { hue: 'ink-mute', opacity: 0.4 });

  const tagPos = {};
  steps.forEach((s, i) => {
    f.beat(i + 1);
    const x = colX(i);
    if (i === 0) {
      f.box({ x: x + 2, y: TASK_Y + 4, w: 66, h: 22, hue: 'violet', title: 'input', titleSize: 11, weight: 400, pad: 3 });
    } else if (!s.tasks.length) {
      f.text(x + 35, TASK_Y + 19, 'none', { size: 11, anchor: 'middle', hue: 'ink-mute' });
    } else {
      s.tasks.forEach((t, k) => {
        const y = TASK_Y + 4 + k * 24;
        const push = t.kind === '__pregel_push';
        f.box({ x: x + 2, y, w: 66, h: 22, hue: 'amber', title: label(t), titleSize: 11, weight: 400, pad: 3, dash: push ? 'dashed' : undefined });
        tagPos[`${i}:${k}`] = [x + 2, y + 11];
      });
    }
    CHANNELS.forEach((ch, r) => {
      const y = rowY(r);
      const v = s.after[ch];
      if (v === undefined) return;
      if (s.changed[ch]) {
        const written = s.written.has(ch) || (i === 0 && ch === '__start__');
        f.rect(x + 4, y + 4, 62, 22, written ? { hue: 'indigo' } : { fill: color('paper'), stroke: color('indigo-ink'), dash: 'dashed' });
        f.text(x + 35, y + 19, `v${v}`, { size: 11.5, anchor: 'middle', weight: 700, hue: 'indigo' });
      } else {
        f.text(x + 35, y + 19, `v${v}`, { size: 11, anchor: 'middle', hue: 'ink-mute' });
      }
    });
    const seen = seenModel[i];
    f.text(x + 35, rowY(4) + 22, seen === null ? '-' : `v${seen}`, { size: 11.5, anchor: 'middle', hue: seen === null ? 'ink-mute' : 'amber' });
  });

  const triggers = [
    [0, '__start__', 1],
    [1, 'branch:to:model', 2],
    [2, '__pregel_tasks', 3],
    [3, 'branch:to:model', 4],
  ];
  triggers.forEach(([from, ch, to], n) => {
    f.beat(to + 1);
    const r = CHANNELS.indexOf(ch);
    const sx = colX(from) + 66;
    const sy = rowY(r) + 15;
    const gx = colX(to) - 3;
    const tag = tagPos[`${to}:0`];
    f.path(`M${sx} ${sy} H${gx} V${tag[1]} H${tag[0] - 1}`, { style: 'state' });
  });

  f.beat(6);
  const x4 = colX(5);
  f.rect(x4 + 4, rowY(2) + 4, 62, 22, { fill: 'none', stroke: color('rose-ink'), dash: 'dashed' });

  f.beat(0);
  const NY = 300;
  const notes = [
    [colX(2) + 35, 1, `step ${steps[2].step}: messages, __pregel_tasks and branch:to:model all get v${steps[2].after.messages}`],
    [colX(4) + 35, 2, `step ${steps[4].step}: branch:to:model v${steps[3].after['branch:to:model']} is newer than seen v${seenModel[3]}, so model runs`],
    [colX(5) + 35, 3, `step ${last.step}: v${lastBranch} is newer than seen v${seenModel[5]}, but the channel is empty: no task`],
  ];
  notes.forEach(([cx, n, text], k) => {
    const y = NY + k * 22;
    f.step(cx, rowY(4) + 44, n, { hue: 'amber' });
    f.step(30, y, n, { hue: 'amber' });
    f.text(46, y + 4, text, { size: 11, serif: true, hue: 'ink-soft' });
  });
  const ky = 384;
  f.rect(20, ky - 11, 22, 14, { hue: 'indigo' });
  f.text(48, ky, 'written, new version', { size: 11, serif: true, hue: 'ink-soft' });
  f.rect(200, ky - 11, 22, 14, { fill: color('paper'), stroke: color('indigo-ink'), dash: 'dashed' });
  f.text(228, ky, 'read and cleared, new version', { size: 11, serif: true, hue: 'ink-soft' });
  f.rect(20, ky + 9, 22, 14, { hue: 'amber', dash: 'dashed' });
  f.text(48, ky + 20, 'PUSH task from a Send', { size: 11, serif: true, hue: 'ink-soft' });
  f.path(`M200 ${ky + 16} H222`, { style: 'state', packet: false });
  f.text(228, ky + 20, 'version that triggers the next task', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, ky + 40, 'grey number: version carried over', { size: 11, serif: true, hue: 'ink-soft' });
  f.rect(330, ky + 29, 22, 14, { fill: 'none', stroke: color('rose-ink'), dash: 'dashed' });
  f.text(358, ky + 40, 'empty channel, triggers nothing', { size: 11, serif: true, hue: 'ink-soft' });
});
