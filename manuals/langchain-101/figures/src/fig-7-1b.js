'use strict';

const path = require('path');
const { figure, color } = require('../../../_shared/figkit.js');
const { load } = require('../../../_shared/chart.js');

const data = load(path.join(__dirname, '../../capture/lab/summary/agent-server-x86.json'));
const X0 = 130;
const SCALE = 66;
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
  height: 384,
  title: 'The nodes of run A and run B under each multitask strategy',
  desc: 'Four tracks on a time axis of 0 to 7 seconds, one thread each under langgraph dev on the x86 server guest. Run A runs two nodes of 2 s each, and run B, sent about 1 s later on the same thread, runs two nodes of 1 s each. Under reject, B is refused with HTTP 409 and A finishes. Under enqueue, B starts when A ends at 4.8 s. Under interrupt, B starts at 1.0 s, and the first node of A never finishes. Under rollback, the first node of A starts just before B is sent, B starts at 1.0 s, and A is deleted.',
}, f => {
  f.rule(px(1.0), 30, px(1.0), 300, { hue: 'rose', dash: 'dashed', width: 1.4 });
  f.text(px(1.0), 22, 'run B sent', { size: 11, hue: 'rose', anchor: 'middle', weight: 700 });
  order.forEach((strategy, i) => {
    const row = data.double_texting.find(r => r.strategy === strategy);
    const y = 44 + i * 64;
    f.kicker(20, y + 14, strategy);
    f.text(20, y + 30, notes[strategy], { size: 11, serif: true, hue: 'ink-soft' });
    for (const s of spans(row.node_events, `${strategy}-A`)) {
      if (s.end === null) {
        const w = Math.max(px(1.0) - px(s.start), 10);
        f.rect(px(s.start), y, w, 12, { fill: 'none', stroke: color('rose-ink'), dash: 'dashed' });
        f.text(px(s.start) + w / 2, y - 4, `A ${s.node}`, { size: 11, hue: 'rose', anchor: 'middle', knock: true });
      } else {
        f.rect(px(s.start), y, px(s.end) - px(s.start) - 2, 12, { fill: color('amber-ink'), stroke: 'none' });
        f.text((px(s.start) + px(s.end)) / 2, y - 4, `A ${s.node}`, { size: 11, hue: 'amber', anchor: 'middle' });
      }
    }
    if (strategy === 'reject') {
      f.text(px(1.0) + 8, y + 32, '409, nothing ran', { size: 11, hue: 'rose' });
    }
    for (const s of spans(row.node_events, `${strategy}-B`)) {
      f.rect(px(s.start), y + 22, px(s.end) - px(s.start) - 2, 12, { fill: color('amber-fill'), stroke: color('amber-ink') });
      f.text((px(s.start) + px(s.end)) / 2, y + 48, `B ${s.node}`, { size: 11, hue: 'amber', anchor: 'middle' });
    }
  });
  f.rule(X0, 306, X0 + 7 * SCALE, 306, { hue: 'ink' });
  for (let t = 0; t <= 7; t += 1) {
    f.rule(px(t), 302, px(t), 310, { hue: 'ink' });
    f.text(px(t), 324, `${t} s`, { size: 11, anchor: 'middle', hue: 'ink-soft' });
  }
  f.text(20, 352, 'Filled: a node of run A. Outlined: a node of run B. Dashed rose: a node of A', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 368, 'that started and never wrote. Times are from the node events, one run each.', { size: 11, serif: true, hue: 'ink-soft' });
});
