'use strict';

const { figure } = require('../../../_shared/figkit.js');

const lanes = [
  { x: 96, title: 'planner', sub: 'client agent', hue: 'violet' },
  { x: 338, title: 'test-runner', sub: 'localhost:41241', hue: 'blue' },
  { x: 556, title: 'task store', sub: 'inside test-runner', hue: 'teal' },
];

const rows = [
  [1, 0, 1, 'call', 'SendStreamingMessage', 'run the full suite at 9f3c2e1'],
  [2, 1, 0, 'event', 'frame 1 · task SUBMITTED', 'task 25239d4c'],
  [2, 1, 0, 'event', 'frame 2 · statusUpdate WORKING', null],
  [3, 1, 0, 'event', 'frame 3 · artifactUpdate', 'test_suite_01, names test-log.txt'],
  [3, 1, 0, 'event', 'frame 4 · artifactUpdate', 'test_suite_02, append: true'],
  [4, 'closed'],
  [5, 1, 2, 'write', 'append test_suite_03', 'no stream is open'],
  [5, 1, 2, 'write', 'append test_suite_04', 'nobody receives a frame'],
  [6, 0, 1, 'call', 'SubscribeToTask 25239d4c', null],
  [6, 2, 1, 'reply', 'stored task', 'log parts 01 to 04 so far'],
  [7, 1, 0, 'event', 'frame 1 · task WORKING', 'snapshot: test-log.txt, 4 parts'],
  [8, 1, 0, 'event', 'frames 2 to 5 · artifactUpdate', 'test_suite_05 to 08, lastChunk on 08'],
  [8, 1, 0, 'event', 'frame 6 · statusUpdate COMPLETED', '96 passed, then the stream closes'],
  [9, 0, 1, 'call', 'SubscribeToTask 25239d4c', 'again, after the end'],
  [9, 1, 0, 'fail', '-32004 UnsupportedOperationError', 'the task is TASK_STATE_COMPLETED'],
];

const STEP = 40;
const TOP = 82;
const height = TOP + rows.length * STEP + 4;

module.exports = figure('fig-stream-resubscribe', {
  height,
  title: 'A dropped stream and its subscription',
  desc: 'Three lifelines: planner, test-runner and its task store. The planner opens SendStreamingMessage and receives four frames: the task in TASK_STATE_SUBMITTED, the working status, and two artifactUpdate chunks of test-log.txt. The planner then closes the connection. test-runner appends chunks 03 and 04 to the stored task while no stream is open, so no client sees them. The planner calls SubscribeToTask, test-runner reads the stored task, and the first frame is a Task snapshot whose test-log.txt already holds four parts. Frames 2 to 5 carry chunks 05 to 08, frame 6 the completed status, and the stream closes. A second SubscribeToTask on the finished task fails with -32004 UnsupportedOperationError.',
}, f => {
  for (const lane of lanes) {
    f.box({ x: lane.x, y: 10, w: 136, h: 40, hue: lane.hue, title: lane.title, sub: lane.sub, titleSize: 12, anchor: 'middle' });
    f.lifeline(lane.x, 50, height - 8);
  }
  let step = 0;
  rows.forEach((row, index) => {
    const y = TOP + index * STEP;
    f.beat(row[0]);
    if (row[1] === 'closed') {
      const x = lanes[0].x;
      f.rule(x - 30, y, x + 30, y, { hue: 'rose', width: 2 });
      f.text(x + 38, y + 4, 'client closes the connection', { size: 11, serif: true, hue: 'rose', weight: 700 });
      return;
    }
    const [, from, to, style, label, note] = row;
    step += 1;
    f.step(24, y, step);
    const x1 = lanes[from].x;
    const x2 = lanes[to].x;
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label, note: note || undefined, labelX: (x1 + x2) / 2 });
  });
});
