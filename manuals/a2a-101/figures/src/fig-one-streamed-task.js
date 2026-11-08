'use strict';

const { figure } = require('../../../_shared/figkit.js');

const PLANNER = 110;
const RUNNER = 400;
const MID = (PLANNER + RUNNER) / 2;

const rows = [
  { beat: 1, step: null, dir: 1, style: 'call', label: 'GET /.well-known/agent-card.json' },
  { beat: 1, step: null, dir: -1, style: 'reply', label: 'AgentCard, capabilities.streaming: true' },
  { beat: 2, step: null, dir: 1, style: 'call', label: 'SendStreamingMessage', note: 'messageId 5bc8fbbc, no taskId' },
  { beat: 2, step: null, dir: -1, style: 'reply', label: 'HTTP 200, text/event-stream' },
  { beat: 3, step: 1, dir: -1, style: 'event', label: 'task · TASK_STATE_SUBMITTED', note: 'task 728ba084, history holds the request', time: '09:00:01.750Z' },
  { beat: 4, step: 2, dir: -1, style: 'event', label: 'statusUpdate · TASK_STATE_WORKING', note: 'Checking out 9f3c2e1 and starting the suite', time: '09:00:02.000Z' },
  { beat: 5, step: 3, dir: -1, style: 'event', label: 'artifactUpdate · test-log.txt', note: 'first chunk: collected 12 items' },
  { beat: 6, step: 4, dir: -1, style: 'event', label: 'artifactUpdate · append' },
  { beat: 7, step: 5, dir: -1, style: 'event', label: 'artifactUpdate · append' },
  { beat: 8, step: 6, dir: -1, style: 'event', label: 'artifactUpdate · append' },
  { beat: 9, step: 7, dir: -1, style: 'event', label: 'artifactUpdate · append, lastChunk' },
  { beat: 10, step: 8, dir: -1, style: 'event', label: 'artifactUpdate · summary.json, lastChunk' },
  { beat: 11, step: 9, dir: -1, style: 'event', label: 'statusUpdate · TASK_STATE_COMPLETED', note: '1 failed, 11 passed', time: '09:00:02.250Z' },
];

const TOP = 84;
const ys = rows.reduce((list, row, index) => list.concat(index ? list[index - 1] + (rows[index - 1].note ? 46 : 34) : TOP), []);
const END = ys[ys.length - 1] + 30;

module.exports = figure('fig-one-streamed-task', {
  height: END + 34,
  title: 'One streamed task from the card read to the close',
  desc: 'Two lifelines, planner and test-runner at localhost:41241. The planner reads the agent card, sends SendStreamingMessage with a new messageId and no taskId, and gets HTTP 200 with text/event-stream. Nine numbered stream frames follow: the task 728ba084 in TASK_STATE_SUBMITTED, a statusUpdate to TASK_STATE_WORKING, five artifactUpdate frames that build test-log.txt, the last with lastChunk, one artifactUpdate for summary.json, and a statusUpdate to TASK_STATE_COMPLETED. Only frames 1, 2 and 9 carry a timestamp, at 09:00:01.750Z, 09:00:02.000Z and 09:00:02.250Z. Then the server closes the stream, with no final flag.',
}, f => {
  f.box({ x: PLANNER, y: 8, w: 132, h: 40, hue: 'violet', title: 'planner', sub: 'client agent', titleSize: 12, anchor: 'middle' });
  f.box({ x: RUNNER, y: 8, w: 140, h: 40, hue: 'blue', title: 'test-runner', sub: 'localhost:41241', titleSize: 12, anchor: 'middle' });
  f.kicker(488, 32, 'kit clock');
  f.lifeline(PLANNER, 48, END);
  f.lifeline(RUNNER, 48, END);

  rows.forEach((row, index) => {
    const y = ys[index];
    f.beat(row.beat);
    if (row.step) f.step(24, y, row.step, { hue: 'indigo' });
    const [x1, x2] = row.dir > 0 ? [PLANNER, RUNNER - 1] : [RUNNER, PLANNER + 1];
    f.arrow([x1, y], [x2, y], { style: row.style, label: row.label, note: row.note, labelX: MID });
    if (row.time) f.text(488, y + 4, row.time, { size: 11, hue: 'amber' });
  });

  f.beat(10);
  const first = ys[6];
  const last = ys[11];
  f.rule(484, first - 8, 484, last + 8, { hue: 'ink-mute' });
  ['frames 3 to 8', 'carry no', 'timestamp'].forEach((line, index) => f.text(492, (first + last) / 2 - 10 + index * 14, line, { size: 11, serif: true, hue: 'ink-soft' }));

  f.beat(12);
  f.rule(PLANNER - 12, END, PLANNER + 12, END, { hue: 'ink', width: 1.6 });
  f.rule(RUNNER - 12, END, RUNNER + 12, END, { hue: 'ink', width: 1.6 });
  f.text(MID, END + 22, 'the server closes the stream after frame 9, with no final flag', { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });
});
