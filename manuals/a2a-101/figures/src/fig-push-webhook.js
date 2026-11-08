'use strict';

const { figure } = require('../../../_shared/figkit.js');

const lanes = [
  { x: 90, w: 136, title: 'planner', sub: 'client agent', hue: 'violet' },
  { x: 320, w: 136, title: 'test-runner', sub: 'localhost:41241', hue: 'blue' },
  { x: 560, w: 150, title: 'webhook receiver', sub: ':41250/a2a-events', hue: 'violet' },
];

const rows = [
  [1, 0, 1, 'call', 'SendMessage', 'returnImmediately, webhook config'],
  [2, 1, 0, 'reply', 'task d7d3dceb SUBMITTED', 'the call returns at once'],
  [3, 1, 2, 'event', 'POST statusUpdate WORKING', 'Authorization: Bearer hook_secret_91d2'],
  [4, 1, 2, 'event', '5 POSTs · artifactUpdate', 'five chunks of test-log.txt'],
  [5, 1, 2, 'event', 'POST artifactUpdate', 'summary.json, a data part'],
  [6, 1, 2, 'event', 'POST statusUpdate COMPLETED', '1 failed, 11 passed'],
  [7, 2, 1, 'reply', '204 No Content', 'the answer to every POST'],
  [8, 0, 1, 'call', 'ListTaskPushNotificationConfigs', 'sent after the task finished'],
  [8, 1, 0, 'reply', 'one config, id 92c697ef', 'the id the server assigned'],
  [9, 0, 1, 'call', 'GetTaskPushNotificationConfig', 'taskId and id'],
  [9, 1, 0, 'reply', 'the same config', null],
  [10, 0, 1, 'call', 'DeleteTaskPushNotificationConfig', null],
  [10, 1, 0, 'reply', 'result: {}', 'no more POSTs for this config'],
];

const STEP = 40;
const TOP = 86;
const height = TOP + rows.length * STEP + 4;

module.exports = figure('fig-push-webhook', {
  height,
  title: 'A webhook for one test run',
  desc: 'Three lifelines: planner, test-runner and the planner webhook receiver on port 41250. The planner sends SendMessage with returnImmediately and a push configuration, and gets back the task in TASK_STATE_SUBMITTED at once. test-runner then posts eight notifications to the receiver: the working status with an Authorization Bearer header, five artifactUpdate chunks of test-log.txt, the summary.json artifact, and the completed status. The receiver answers each POST with 204 No Content. After the task has finished, the planner lists, reads, and deletes the push configuration, whose server-assigned id is 92c697ef.',
}, f => {
  for (const lane of lanes) {
    f.box({ x: lane.x, y: 10, w: lane.w, h: 40, hue: lane.hue, title: lane.title, sub: lane.sub, titleSize: 12, anchor: 'middle' });
    f.lifeline(lane.x, 50, height - 8);
  }
  rows.forEach(([beat, from, to, style, label, note], index) => {
    const y = TOP + index * STEP;
    f.beat(beat);
    f.step(24, y, index + 1);
    const x1 = lanes[from].x;
    const x2 = lanes[to].x;
    f.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y], { style, label, note: note || undefined, labelX: (x1 + x2) / 2 });
  });
});
