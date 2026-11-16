'use strict';

const fs = require('fs');
const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');

const events = fs.readFileSync(path.join(__dirname, '../../capture/lab/internals/03-checkpoint/a_sync.trace.jsonl'), 'utf8')
  .trim().split('\n').map(line => JSON.parse(line));

const done = events.filter(e => e.event === 'loop.put_writes');
const puts = events.filter(e => e.event === 'saver.put');
const writes = events.filter(e => e.event === 'saver.put_writes');
const ticks = events.filter(e => e.event === 'tick');
const steps = [...new Set(done.map(d => d.step))];
const panels = steps.map(step => {
  const tasks = done.filter(d => d.step === step).map(d => {
    const w = writes.find(x => x.task_id === d.task_id);
    if (!w) throw new Error(`fig-2-3: no put_writes for ${d.task_id}`);
    return { name: d.task, id: d.task_id, back: d.t_ms, durable: w.t_ms, start: w.t_ms - w.dt_us / 1000 };
  });
  const t0 = Math.min(...tasks.map(t => t.back));
  const put = puts.find(p => p.step === step);
  const extra = step === 0 ? puts.find(p => p.step === -1) : null;
  const next = ticks.find(t => t.step === step + 1);
  return { step, tasks, t0, put, extra, next };
});
const waits = panels.flatMap(p => p.tasks.map(t => t.durable - t.back));
const lo = Math.min(...waits);
const hi = Math.max(...waits);
const late = panels.find(p => p.tasks.some(t => t.durable > p.put.t_ms));
const gapS = i => (panels[i + 1].t0 - panels[i].t0) / 1000;

const PW = 126;
const PG = 16;
const PX0 = 62;
const SPAN = 7;
const LOOP_Y = 96;
const SAVER_Y = 160;
const fmt = v => v.toFixed(1);

module.exports = figure('fig-2-3', {
  height: 400,
  title: 'How long each finished task waits for its put_writes, in one sync run',
  desc: `Four panels, one per superstep of one create_agent run with Qwen3 4B, durability sync, on SqliteSaver on the x86 server guest. Each panel spans ${SPAN} ms after the first task of the step returned. The upper lane is the loop: a dot for each task that returned and an amber line where the next superstep starts. The lower lane is the background saver: filled blocks are put calls that store a checkpoint, and outlined blocks are put_writes calls that store the writes of one task. A rose band runs from each task's return to the end of its put_writes. Those spans were ${fmt(lo)} to ${fmt(hi)} ms, in one run on a loaded guest. In step ${late.step}, the checkpoint put ended before the put_writes of the task ${late.tasks[0].id}. Between the panels the model ran for seconds.`,
}, f => {
  f.text(20, LOOP_Y + 4, 'loop', { size: 12, weight: 700, hue: 'indigo' });
  f.text(20, SAVER_Y + 4, 'saver', { size: 12, weight: 700, hue: 'teal' });
  panels.forEach((p, i) => {
    const x0 = PX0 + i * (PW + PG);
    const X = t => x0 + ((t - p.t0) / SPAN) * PW;
    f.beat(i + 1);
    f.rect(x0, 50, PW, 168, { fill: color('code-bg'), stroke: 'none' });
    f.text(x0 + PW / 2, 42, `step ${p.step}`, { size: 11.5, anchor: 'middle', hue: 'amber', weight: 700 });
    f.rule(x0, LOOP_Y, x0 + PW, LOOP_Y, { hue: 'indigo', opacity: 0.5 });
    f.rule(x0, SAVER_Y, x0 + PW, SAVER_Y, { hue: 'teal', opacity: 0.5 });
    p.tasks.forEach((t, k) => {
      f.dot(X(t.back), LOOP_Y, { hue: 'indigo', r: 3.5 });
      const y = SAVER_Y + 8 + k * 16;
      f.rect(Math.max(x0, X(t.start)), y, X(t.durable) - Math.max(x0, X(t.start)), 10, { fill: color('paper'), stroke: color('teal-ink') });
      f.rect(X(t.back), y + 12, X(t.durable) - X(t.back), 3, { fill: color('rose-ink'), stroke: 'none' });
    });
    for (const q of [p.put, p.extra].filter(Boolean)) {
      const a = Math.max(x0, X(q.t_ms - q.dt_us / 1000));
      if (X(q.t_ms) <= x0 + PW) f.rect(a, SAVER_Y - 18, X(q.t_ms) - a, 12, { hue: 'teal' });
    }
    if (p.next && X(p.next.t_ms) <= x0 + PW) f.rule(X(p.next.t_ms), 74, X(p.next.t_ms), 214, { hue: 'amber', width: 1.6 });
    for (let t = 0; t <= SPAN; t += 2) {
      f.rule(X(p.t0 + t), 218, X(p.t0 + t), 222, { hue: 'ink' });
      f.text(X(p.t0 + t), 236, String(t), { size: 11, anchor: 'middle', hue: 'ink-soft' });
    }
    f.text(x0 + PW / 2, 66, p.tasks.map(t => t.name.replace(/^__start__$/, 'start')).join(', '), { size: 11, anchor: 'middle', hue: 'ink-soft' });
    if (i < panels.length - 1) {
      const nxt = panels[i + 1].tasks[0].name;
      f.text(x0 + PW + PG / 2, 264, `${nxt} ${gapS(i).toFixed(2)} s`, { size: 11, anchor: 'middle', hue: nxt === 'model' ? 'plum' : 'green' });
    }
  });
  f.text(20, 236, 'ms', { size: 11, hue: 'ink-soft' });

  f.beat(5);
  const li = panels.indexOf(late);
  const lx0 = PX0 + li * (PW + PG);
  const LX = t => lx0 + ((t - late.t0) / SPAN) * PW;
  f.step(LX(late.put.t_ms) - 14, SAVER_Y - 32, 1);
  f.step(LX(late.tasks[0].durable) + 12, SAVER_Y + 34, 2, { hue: 'rose' });

  f.beat(0);
  const notes = [
    [1, 'ink', `step ${late.step}: the checkpoint put ends, sync stops waiting, and step ${late.step + 1} starts`],
    [2, 'rose', `the put_writes of ${late.tasks[0].id} ends ${fmt(late.tasks[0].durable - late.put.t_ms)} ms later`],
  ];
  notes.forEach(([n, hue, text], k) => {
    const y = 300 + k * 22;
    f.step(30, y, n, { hue });
    f.text(46, y + 4, text, { size: 11, serif: true, hue: 'ink-soft' });
  });
  const ky = 360;
  f.dot(26, ky - 4, { hue: 'indigo', r: 3.5 });
  f.text(36, ky, 'task returned', { size: 11, serif: true, hue: 'ink-soft' });
  f.rect(150, ky - 11, 12, 12, { hue: 'teal' });
  f.text(168, ky, 'put', { size: 11, serif: true, hue: 'ink-soft' });
  f.rect(214, ky - 11, 12, 12, { fill: color('paper'), stroke: color('teal-ink') });
  f.text(232, ky, 'put_writes', { size: 11, serif: true, hue: 'ink-soft' });
  f.rect(320, ky - 6, 16, 3, { fill: color('rose-ink'), stroke: 'none' });
  f.text(342, ky, `not durable, ${fmt(lo)} to ${fmt(hi)} ms`, { size: 11, serif: true, hue: 'ink-soft' });
  f.rule(26, ky + 10, 26, ky + 24, { hue: 'amber', width: 1.6 });
  f.text(36, ky + 22, 'next superstep starts', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(232, ky + 22, 'between panels: the next task and its seconds', { size: 11, serif: true, hue: 'ink-soft' });
});
