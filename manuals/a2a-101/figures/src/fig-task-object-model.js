'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

const rows = [
  ['id', '3d8f7801'],
  ['contextId', 'ac3830af'],
  ['status.state', 'TASK_STATE_COMPLETED'],
  ['status.message', '1 failed, 11 passed'],
  ['status.timestamp', '2026-10-06T09:00:00.750Z'],
  ['artifacts', '2 artifacts'],
  ['history', '2 messages'],
];

const parts = [
  ['text', 'collected 12 items'],
  ['raw', 'refunds.diff, base64'],
  ['url', 'screenshot.png'],
  ['data', '"passed": 11'],
];

module.exports = figure('fig-task-object-model', {
  height: 420,
  title: 'The object model of one task',
  desc: 'A dashed frame marks context ac3830af. Inside it, task 3d8f7801 from the blocking run is drawn as a table that fills in the order the run filled it: id and contextId, then the two history messages, the user message 21636369 and the agent message 10cc3c92 with their roles, then the artifacts test-log and summary with their names and part counts, and last status.state TASK_STATE_COMPLETED, status.message 1 failed, 11 passed, and status.timestamp 2026-10-06T09:00:00.750Z. Below, four chips show that a part holds exactly one of text, raw, url or data, with an example of each.',
}, f => {
  const row = index => {
    const [field, value] = rows[index];
    const y = 68 + index * 28;
    f.rect(26, y, 310, 28, { fill: color('paper'), stroke: color('panel-edge') });
    f.text(38, y + 18, field, { size: 11.5, hue: 'ink-soft' });
    f.text(160, y + 18, value, { size: 11.5 });
  };
  const link = { style: 'call', hue: 'ink-mute', head: false };

  f.box({ x: 26, y: 40, w: 310, h: 28, hue: 'amber', title: 'Task', align: 'left', titleSize: 12 });
  f.kicker(20, 324, 'every message and artifact holds parts');
  parts.forEach(([title, sub], index) => f.box({ x: 20 + index * 152, y: 332, w: 144, h: 46, hue: 'green', title, sub, titleSize: 12, pad: 8 }));
  f.text(20, 400, 'Each part holds exactly one of these four, plus optional mediaType, filename and metadata.', { size: 11, serif: true, hue: 'ink-soft' });

  f.beat(1);
  f.rect(14, 8, 612, 290, { fill: 'none', stroke: color('ink-mute'), dash: 'dashed' });
  f.text(26, 28, 'context ac3830af', { size: 12, weight: 700 });
  f.text(158, 28, 'groups related tasks and messages, and this run made one task', { size: 11, serif: true, hue: 'ink-soft' });
  row(0);
  row(1);

  f.beat(2);
  row(6);
  f.box({ x: 360, y: 166, w: 256, h: 52, hue: 'violet', title: 'messageId: 21636369', sub: ['role: ROLE_USER', 'parts: 1 text part'], titleSize: 12, align: 'left' });
  f.path('M336 250 H352 V192 H360', link);

  f.beat(3);
  f.box({ x: 360, y: 224, w: 256, h: 52, hue: 'blue', title: 'messageId: 10cc3c92', sub: ['role: ROLE_AGENT', 'parts: 1 text part'], titleSize: 12, align: 'left' });
  f.path('M352 250 H360', link);

  f.beat(4);
  row(5);
  f.box({ x: 360, y: 40, w: 256, h: 52, hue: 'green', title: 'artifactId: test-log', sub: ['name: test-log.txt', 'parts: 5 text parts'], titleSize: 12, align: 'left' });
  f.box({ x: 360, y: 98, w: 256, h: 52, hue: 'green', title: 'artifactId: summary', sub: ['name: summary.json', 'parts: 1 data part'], titleSize: 12, align: 'left' });
  f.path('M336 222 H346 V66 H360', link);
  f.path('M346 124 H360', link);

  f.beat(5);
  row(2);
  row(3);
  row(4);
});
