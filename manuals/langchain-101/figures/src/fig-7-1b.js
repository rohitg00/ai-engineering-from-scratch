'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/agent-server-x86.json'));
const X0 = 150;
const SCALE = 64;
const px = t => X0 + t * SCALE;
const order = ['reject', 'enqueue', 'interrupt', 'rollback'];
const notes = {
  reject: 'B refused, HTTP 409',
  enqueue: 'B waits for A, then runs',
  interrupt: 'A interrupted, its node lost',
  rollback: 'A deleted, B runs alone',
};

function spans(events, label) {
  const out = [];
  for (const node of ['first', 'second']) {
    const start = events.find(e => e.label === label && e.ev === `${node}_start`);
    if (!start) continue;
    const end = events.find(e => e.label === label && e.ev === `${node}_end`);
    out.push({ node, start: start.dt, end: end ? end.dt : null });
  }
  return out;
}

module.exports = figure('fig-7-1b', {
  height: 396,
  title: 'The nodes of run A and run B under each multitask strategy',
  desc: 'Four tracks on a time axis of 0 to 7 seconds, one thread each under langgraph dev on the x86 server guest. Run A runs two nodes of 2 s each, and run B, sent about 1 s later on the same thread, runs two nodes of 1 s each. Under reject, B is refused with HTTP 409 and A finishes. Under enqueue, B starts when A ends at 4.8 s. Under interrupt, B starts at 1.0 s, and the first node of A never finishes. Under rollback, the first node of A starts just before B is sent, B starts at 1.0 s, and A is deleted.',
}, f => {
  const LANE = 136;
  f.rule(px(1.0), 30, px(1.0), 318, { hue: 'rose', dash: 'dashed', width: 1.4 });
  f.text(px(1.0), 22, 'run B sent', { size: 11, hue: 'rose', anchor: 'middle', weight: 700 });
  order.forEach((strategy, i) => {
    const row = data.double_texting.find(r => r.strategy === strategy);
    const y = 46 + i * 70;
    f.beat(i + 1);
    f.kicker(20, y, strategy);
    f.text(20, y + 16, notes[strategy], { size: 11, serif: true, hue: 'ink-soft' });
    f.text(LANE, y + 34, 'A', { size: 11, weight: 700, anchor: 'end', hue: 'amber' });
    f.text(LANE, y + 54, 'B', { size: 11, weight: 700, anchor: 'end', hue: 'amber' });
    f.rule(px(0), y + 30, px(7), y + 30, { opacity: 0.25 });
    f.rule(px(0), y + 50, px(7), y + 50, { opacity: 0.25 });
    for (const s of spans(row.node_events, `${strategy}-A`)) {
      if (s.end === null) {
        const w = Math.max(px(1.0) - px(s.start), 8);
        f.rect(px(s.start), y + 22, w, 16, { fill: 'none', stroke: color('rose-ink'), dash: 'dashed' });
        f.text(Math.max(px(1.0), px(s.start) + w) + 10, y + 34, `${s.node} node of A never wrote`, { size: 11, hue: 'rose', knock: true });
      } else {
        f.rect(px(s.start), y + 22, px(s.end) - px(s.start) - 2, 16, { fill: color('amber-ink'), stroke: 'none' });
        f.text((px(s.start) + px(s.end)) / 2, y + 34, s.node, { size: 11, hue: 'paper', anchor: 'middle' });
      }
    }
    if (strategy === 'reject') f.text(px(1.0) + 6, y + 54, '409, nothing ran', { size: 11, hue: 'rose', knock: true });
    for (const s of spans(row.node_events, `${strategy}-B`)) {
      f.rect(px(s.start), y + 42, px(s.end) - px(s.start) - 2, 16, { fill: color('amber-fill'), stroke: color('amber-ink') });
      f.text((px(s.start) + px(s.end)) / 2, y + 54, s.node, { size: 11, hue: 'amber', anchor: 'middle' });
    }
  });
  f.beat(0);
  f.rule(px(0), 326, px(7), 326, { hue: 'ink' });
  for (let t = 0; t <= 7; t += 1) {
    f.rule(px(t), 322, px(t), 330, { hue: 'ink' });
    f.text(px(t), 344, `${t} s`, { size: 11, anchor: 'middle', hue: 'ink-soft' });
  }
  f.text(20, 370, 'Lane A: the nodes of run A, filled. Lane B: the nodes of run B, outlined. Dashed rose: a node', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 386, 'of A that started and never wrote. Times are from the node events, one run each.', { size: 11, serif: true, hue: 'ink-soft' });
});
