'use strict';

const fs = require('fs');
const path = require('path');
const { figure } = require('../../../_shared/figkit.js');

const text = fs.readFileSync(path.join(__dirname, '../../capture/lab/internals/04-interrupt/trace.txt'), 'utf8');
const part = (start, end) => {
  const i = text.indexOf(start);
  const j = end ? text.indexOf(end, i + 1) : -1;
  if (i < 0) throw new Error(`fig-2-4: no "${start}"`);
  return text.slice(i, j < 0 ? undefined : j);
};
const logs = body => [...body.matchAll(/^\s+(\{"node".*\})$/gm)].map(m => JSON.parse(m[1]));
const ids = body => [...body.matchAll(/returned interrupt id=([0-9a-f]+) value=\{'q': '([^']+)'\}/g)].map(m => ({ id: m[1].slice(0, 8), q: m[2] }));

const run1 = part('## run 1', '## run 2a');
const run2a = part('## run 2a', '## run 2b');
const run2b = part('## run 2b', '## run 3');
const run3 = part('## run 3', '## model calls per invocation');
const perCall = JSON.parse(/## model calls per invocation: (\{.*\})/.exec(text)[1].replace(/'/g, '"'));
const history = [...part('## checkpoint history').matchAll(/step=(-?\d+) source=(\w+)/g)].map(m => Number(m[1]));
if (history.length !== 4) throw new Error('fig-2-4: expected four checkpoints');
const err = /raises (\w+):/.exec(run2a)[1];
const reapplied = /reapplied\(no rerun\)=\['(\w+)'\]/.exec(run2b)[1];
const i1 = ids(run1);
const i2 = ids(run2b);
const enter = (body, node) => logs(body).find(l => l.node === node && l.event.startsWith('enter'));
const listOf = (body, node) => `[${(enter(body, node)['scratchpad.resume'] || []).join(', ')}]`;
const ran = (body, node) => logs(body).some(l => l.node === node);
const calls = (body, node) => logs(body).filter(l => l.node === node && l.event.startsWith('model call')).length;
const returned = (body, node) => logs(body).filter(l => l.node === node && /returned/.test(l.event)).map(l => /'([^']+)'/.exec(l.event)[1]);
const plural = n => `${n} model call${n === 1 ? '' : 's'}`;

const askId1 = i1[0].id;
const approveId = i1[1].id;
const askId2 = i2[0].id;
const nullResume = enter(run3, 'ask').null_resume;
const total = Object.values(perCall).reduce((a, b) => a + b, 0);

const cells = {
  ask: [
    { hue: 'amber', lines: [`enter, list ${listOf(run1, 'ask')}`, plural(calls(run1, 'ask')), 'call #0 stops', `id ${askId1}`] },
    { hue: 'amber', lines: [`enter, list ${listOf(run2b, 'ask')}`, plural(calls(run2b, 'ask')), `#0 returns ${returned(run2b, 'ask')[0]}`, `#1 stops ${askId2}`] },
    { hue: 'teal', lines: [`enter, list ${listOf(run3, 'ask')}`, plural(calls(run3, 'ask')), `#0 replays ${returned(run3, 'ask')[0]}`, `#1 gets ${nullResume}, done`] },
  ],
  approve: [
    { hue: 'amber', lines: [`enter, list ${listOf(run1, 'approve')}`, plural(calls(run1, 'approve')), 'call #0 stops', `id ${approveId}`] },
    { hue: 'teal', lines: [`enter, list ${listOf(run2b, 'approve')}`, plural(calls(run2b, 'approve')), `#0 returns ${returned(run2b, 'approve')[0]}`, 'done'] },
    null,
  ],
  other: [
    { hue: 'teal', lines: ['runs once', plural(calls(run1, 'other')), 'done', 'writes saved'] },
    { hue: 'teal', dash: true, lines: ['not run', plural(calls(run2b, 'other')), 'saved writes', 'reapplied'] },
    null,
  ],
  after: [null, null, { hue: 'teal', lines: ['runs', plural(calls(run3, 'after')), 'done'] }],
};
if (reapplied !== 'other' || ran(run2b, 'other') || ran(run3, 'approve') || !ran(run3, 'after')) throw new Error('fig-2-4: capture does not match the drawing');

const COLS = [
  { x: 108, w: 146, head: 'invoke(input)', sub: 'run 1', key: 'run 1' },
  { x: 260, w: 68, head: "'yes'", sub: 'run 2a', key: 'run 2a' },
  { x: 334, w: 146, head: '{id: answer}', sub: 'run 2b', key: 'run 2b' },
  { x: 486, w: 136, head: "'A2'", sub: 'run 3', key: 'run 3' },
];
const RUN_COL = [0, 2, 3];
const ROWS = ['ask', 'approve', 'other', 'after'];
const Y0 = 62;
const RH = 76;

module.exports = figure('fig-2-4', {
  height: 520,
  title: 'Three calls that answer three questions in two parallel nodes',
  desc: `A grid of four nodes against four calls on one thread with InMemorySaver and Qwen3 4B on the x86 server guest. ask, approve, and other run in parallel after START, and after runs last. ask and approve each ask the model for a question before they call interrupt. Call 1 starts the run: ask stops at its first interrupt with id ${askId1}, approve stops with id ${approveId}, and other finishes. Call 2a resumes with one plain value and raises ${err}, because two interrupts wait, and makes no model call. Call 2b resumes with a map from id to answer: approve asks the model again, gets OK, and finishes. ask asks the model again, replays its first answer, asks for its second question, and stops with id ${askId2}. other does not run, because its saved writes are reapplied. Call 3 resumes with A2: ask runs a third time with two model calls and finishes, and after runs. The calls made ${perCall['run 1']}, ${perCall['run 2a']}, ${perCall['run 2b']}, and ${perCall['run 3']} model calls, ${total} for five prompts. The thread holds ${history.length} checkpoints, steps ${history.slice().reverse().join(', ')}.`,
}, f => {
  f.kicker(20, 22, 'call');
  f.text(20, 40, 'resume value', { size: 11, serif: true, hue: 'ink-soft' });
  COLS.forEach((c, k) => {
    f.text(c.x + c.w / 2, 22, c.sub, { size: 11, anchor: 'middle', hue: 'ink-mute' });
    f.text(c.x + c.w / 2, 40, c.head, { size: 11.5, anchor: 'middle', weight: 700, hue: k === 1 ? 'rose' : 'violet' });
  });
  ROWS.forEach((node, r) => {
    const y = Y0 + r * RH;
    f.text(20, y + 34, node, { size: 12, weight: 700, hue: 'indigo' });
    f.rule(16, y - 4, 624, y - 4, { hue: 'ink-mute', opacity: 0.3 });
  });
  RUN_COL.forEach((col, k) => {
    f.beat(col === 0 ? 1 : col === 2 ? 3 : 4);
    const c = COLS[col];
    ROWS.forEach((node, r) => {
      const cell = cells[node][k];
      const y = Y0 + r * RH;
      if (!cell) {
        f.text(c.x + c.w / 2, y + 36, '-', { size: 11, anchor: 'middle', hue: 'ink-mute' });
        return;
      }
      f.rect(c.x, y, c.w, RH - 10, { hue: cell.hue, dash: cell.dash ? 'dashed' : undefined });
      cell.lines.forEach((line, i) => f.text(c.x + 6, y + 15 + i * 15, line, { size: 11, hue: i === 0 ? 'ink-soft' : i === 1 ? 'plum' : cell.hue, max: c.w - 10 }));
    });
  });
  f.beat(2);
  const c2 = COLS[1];
  f.rect(c2.x, Y0, c2.w, 3 * RH - 10, { hue: 'rose', dash: 'dashed' });
  ['Runtime', 'Error', '', '2 waiting', 'no node', 'ran'].forEach((line, i) => {
    if (line) f.text(c2.x + c2.w / 2, Y0 + 40 + i * 16, line, { size: 11, anchor: 'middle', hue: i < 2 ? 'rose' : 'ink-soft', weight: i < 2 ? 700 : undefined });
  });

  f.beat(5);
  const my = Y0 + 4 * RH + 8;
  f.text(20, my + 14, 'model calls', { size: 11.5, hue: 'plum', weight: 700 });
  f.text(20, my + 40, 'checkpoints', { size: 11.5, hue: 'teal', weight: 700 });
  const made = [history.filter(s => s <= 0), [], [], history.filter(s => s > 0)];
  COLS.forEach((c, k) => {
    f.text(c.x + c.w / 2, my + 14, String(perCall[c.key]), { size: 12, anchor: 'middle', hue: 'plum', weight: 700 });
    const steps = made[k];
    f.text(c.x + c.w / 2, my + 40, steps.length ? `step ${steps.sort((a, b) => a - b).join(', step ')}` : 'none', { size: 11, anchor: 'middle', hue: steps.length ? 'teal' : 'ink-mute' });
  });
  f.text(334 + 73, my + 56, 'answers saved as writes', { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });
  f.text(334 + 73, my + 70, 'on the step 0 checkpoint', { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });

  f.beat(0);
  const ky = 486;
  f.rect(20, ky - 11, 22, 14, { hue: 'amber' });
  f.text(48, ky, 'stops at an interrupt', { size: 11, serif: true, hue: 'ink-soft' });
  f.rect(220, ky - 11, 22, 14, { hue: 'teal' });
  f.text(248, ky, 'finishes', { size: 11, serif: true, hue: 'ink-soft' });
  f.rect(340, ky - 11, 22, 14, { hue: 'teal', dash: 'dashed' });
  f.text(368, ky, 'writes reapplied, no run', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, ky + 22, `list: the resume list on entry; ${total} model calls for five prompts in all`.replace(';', ','), { size: 11, serif: true, hue: 'ink-soft' });
});
