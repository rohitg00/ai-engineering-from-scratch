'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

const history = [
  { slot: 'history[0]', role: 'ROLE_USER', text: 'Review this diff of payments-api. + refunds.diff', one: false },
  { slot: 'history[1]', role: 'ROLE_AGENT', text: 'Which base branch should I compare this diff against?', one: false },
  { slot: 'history[2]', role: 'ROLE_USER', text: 'main', one: false },
  { slot: 'history[3]', role: 'ROLE_AGENT', text: 'Comparing the diff against main', one: true },
];

const tasks = [
  { id: 'f22ed7af', state: 'TASK_STATE_CANCELED', at: '09:00:03.750' },
  { id: '8ae21dcb', state: 'TASK_STATE_FAILED', at: '09:00:03.000' },
  { id: '728ba084', state: 'TASK_STATE_COMPLETED', at: '09:00:02.250' },
  { id: 'd0c28826', state: 'TASK_STATE_COMPLETED', at: '09:00:01.500' },
  { id: '3d8f7801', state: 'TASK_STATE_COMPLETED', at: '09:00:00.750' },
];

const pages = [
  { first: 0, count: 2, title: 'page 1', sub: 'returns cursor 1', dash: undefined, hue: 'indigo' },
  { first: 2, count: 2, title: 'page 2', sub: 'returns cursor 2', dash: undefined, hue: 'indigo' },
  { first: 4, count: 1, title: 'not requested', sub: null, dash: 'dashed', hue: 'grey' },
];

const rowY = index => 44 + index * 24;
const taskY = index => 280 + index * 24;

module.exports = figure('fig-history-and-pages', {
  height: 452,
  title: 'History regimes and list pages',
  desc: 'Top: the stored history of review task e5c95b09, four messages from history[0] to history[3], plus the status message 2 findings, which is never part of history. With historyLength unset GetTask returns all four messages, with historyLength 1 only history[3], and with historyLength 0 no history field. Bottom: the five tasks on test-runner sorted by status timestamp, newest first. ListTasks with pageSize 2 returns f22ed7af and 8ae21dcb, then 728ba084 and d0c28826, and each page ends with an opaque cursor token for the next one. The fifth task, 3d8f7801, was not requested. Neither page carries artifacts or history. A third call filters on TASK_STATE_CANCELED with no historyLength and gets f22ed7af with its full history.',
}, f => {
  f.kicker(20, 16, 'A · history');
  f.text(126, 16, 'GetTask on the review task e5c95b09, held by code-reviewer', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(560, 16, 'historyLength', { size: 11, anchor: 'middle', hue: 'ink-mute' });
  f.text(530, 36, 'unset', { size: 11, anchor: 'middle', hue: 'ink-soft' });
  f.text(590, 36, '1', { size: 11, anchor: 'middle', hue: 'ink-soft' });
  f.rule(20, 230, 620, 230, { hue: 'ink-mute', dash: 'dashed' });
  f.kicker(20, 250, 'B · pages');
  f.text(112, 250, 'ListTasks on test-runner with pageSize 2 and historyLength 0', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(32, 272, 'id', { size: 11, hue: 'ink-mute' });
  f.text(118, 272, 'state', { size: 11, hue: 'ink-mute' });
  f.text(300, 272, 'status.timestamp', { size: 11, hue: 'ink-mute' });

  f.beat(1);
  history.forEach((row, index) => {
    const y = rowY(index);
    f.rect(20, y, 600, 24, { fill: color('paper'), stroke: color('panel-edge') });
    f.text(30, y + 16, row.slot, { size: 11, hue: 'teal' });
    f.text(104, y + 16, row.role, { size: 11, hue: row.role === 'ROLE_USER' ? 'violet' : 'blue' });
    f.text(184, y + 16, row.text, { size: 11, serif: true });
  });

  f.beat(2);
  f.rect(20, 148, 600, 24, { fill: color('blue-fill'), stroke: color('blue-ink') });
  f.text(30, 164, 'status.message', { size: 11, hue: 'blue' });
  f.text(184, 164, '2 findings, returned every time, never in history', { size: 11, serif: true });

  f.beat(3);
  f.text(30, 192, 'history messages returned', { size: 11, serif: true, hue: 'ink-soft' });
  history.forEach((row, index) => f.dot(530, rowY(index) + 12, { r: 3.5 }));
  f.dot(530, 160, { r: 3.5 });
  f.text(530, 192, '4', { size: 12, anchor: 'middle', weight: 700 });

  f.beat(4);
  history.forEach((row, index) => { if (row.one) f.dot(590, rowY(index) + 12, { r: 3.5 }); });
  f.dot(590, 160, { r: 3.5 });
  f.text(590, 192, '1', { size: 12, anchor: 'middle', weight: 700 });

  f.beat(5);
  f.text(30, 214, 'historyLength 0, on task d0c28826 in 04-polling.http: the reply has no history field at all', { size: 11, serif: true, hue: 'ink-soft' });

  f.beat(6);
  tasks.forEach((task, index) => {
    const y = taskY(index);
    const missing = index === 4;
    f.rect(20, y, 440, 24, { fill: color('paper'), stroke: color('panel-edge'), dash: missing ? 'dashed' : undefined });
    f.text(32, y + 16, task.id, { size: 11.5, hue: missing ? 'ink-mute' : undefined });
    f.text(118, y + 16, task.state, { size: 11.5, hue: missing ? 'ink-mute' : 'amber' });
    f.text(300, y + 16, task.at, { size: 11.5, hue: missing ? 'ink-mute' : 'teal' });
  });

  pages.forEach((page, index) => {
    f.beat(7 + index);
    f.box({ x: 470, y: taskY(page.first), w: 150, h: page.count * 24, hue: page.hue, dash: page.dash, title: page.title, titleSize: 11.5, sub: page.sub || [] });
  });
  f.text(30, 418, 'totalSize 5 on both pages, and no task carries artifacts or history', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(30, 438, 'filter on TASK_STATE_CANCELED, no historyLength: f22ed7af with its full history, token ""', { size: 11, serif: true, hue: 'ink-soft' });
});
