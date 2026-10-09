'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

const TICKS = { submitted: 200, working: 360, completed: 520 };
const CHUNKS = [375, 440, 455, 470, 485, 500];

const tracks = [
  {
    y: 64,
    kicker: 'A · blocking',
    label: 'SendMessage with no configuration, task 3d8f7801',
    marks: [
      { x: TICKS.submitted, seen: false, text: 'not seen', beat: 1 },
      { x: TICKS.working, seen: false, text: 'not seen', beat: 1 },
      { x: TICKS.completed, seen: true, text: '09:00:00.750', beat: 2 },
    ],
    chunks: [{ at: CHUNKS, beat: 1 }],
    requests: [{ x1: 50, x2: TICKS.completed, step: 1, text: 'one request, held open until the reply', beat: 1 }],
  },
  {
    y: 164,
    kicker: 'B · at once',
    label: 'returnImmediately, then GetTask twice, task d0c28826',
    marks: [
      { x: TICKS.submitted, seen: true, text: '09:00:01.000', beat: 3 },
      { x: TICKS.working, seen: true, text: '09:00:01.250', beat: 4 },
      { x: TICKS.completed, seen: true, text: '09:00:01.500', beat: 5 },
    ],
    chunks: [{ at: CHUNKS.slice(0, 1), beat: 4 }, { at: CHUNKS.slice(1), beat: 5 }],
    requests: [
      { x1: 50, x2: TICKS.submitted, step: 2, text: 'SendMessage', beat: 3 },
      { x1: 392, x2: 432, step: 3, beat: 4 },
      { x1: 540, x2: 580, step: 4, beat: 5 },
    ],
  },
];

const key = [
  [1, 'SendMessage, blocking: one reply, the completed task with test-log.txt and summary.json'],
  [2, 'SendMessage with returnImmediately: the reply holds TASK_STATE_SUBMITTED'],
  [3, 'GetTask, historyLength 0: TASK_STATE_WORKING and the first of five log parts'],
  [4, 'GetTask, historyLength 0: TASK_STATE_COMPLETED, five log parts, and summary.json'],
];

module.exports = figure('fig-blocking-and-return', {
  height: 334,
  title: 'A blocking call and a call that returns at once',
  desc: 'Two timelines aligned at the request, on the kit clock. Track A: one blocking SendMessage for task 3d8f7801 stays open while the task passes TASK_STATE_SUBMITTED and TASK_STATE_WORKING, which the client never sees, and six artifact chunks arrive. The reply comes at TASK_STATE_COMPLETED, 09:00:00.750. Track B: SendMessage with returnImmediately for task d0c28826 returns at TASK_STATE_SUBMITTED, 09:00:01.000. A first GetTask sees TASK_STATE_WORKING at 09:00:01.250 with one log part, and a second GetTask sees TASK_STATE_COMPLETED at 09:00:01.500 with all artifacts.',
}, f => {
  for (const track of tracks) {
    f.kicker(20, track.y - 46, track.kicker);
    f.text(150, track.y - 46, track.label, { size: 11, serif: true, hue: 'ink-soft' });
    f.rule(40, track.y, 620, track.y, { hue: 'ink-mute' });
  }
  f.rule(40, 212, 620, 212, { hue: 'ink' });
  for (const [name, x] of [['TASK_STATE_SUBMITTED', TICKS.submitted], ['TASK_STATE_WORKING', TICKS.working], ['TASK_STATE_COMPLETED', TICKS.completed]]) {
    f.rule(x, 208, x, 216, { hue: 'ink' });
    f.text(x, 230, name, { size: 11, anchor: 'middle', hue: 'amber' });
  }
  f.kicker(20, 230, 'kit clock');
  key.forEach(([step, text], index) => {
    const y = 258 + index * 20;
    f.step(30, y - 4, step, { hue: 'violet' });
    f.text(48, y, text, { size: 11, serif: true });
  });

  for (let beat = 1; beat <= 5; beat += 1) {
    f.beat(beat);
    for (const track of tracks) {
      for (const request of track.requests.filter(item => item.beat === beat)) {
        f.rect(request.x1, track.y + 10, request.x2 - request.x1, 20, { hue: 'violet' });
        f.step(request.text ? request.x1 + 13 : (request.x1 + request.x2) / 2, track.y + 20, request.step, { hue: 'violet' });
        if (request.text) f.text(request.x1 + 28, track.y + 24, request.text, { size: 11, hue: 'violet' });
      }
      for (const group of track.chunks.filter(item => item.beat === beat)) {
        for (const x of group.at) f.rule(x, track.y - 6, x, track.y + 6, { hue: 'green', width: 2 });
      }
      for (const mark of track.marks.filter(item => item.beat === beat)) {
        f.rect(mark.x - 4, track.y - 4, 8, 8, mark.seen ? { fill: color('amber-ink'), stroke: 'none' } : { fill: color('paper'), stroke: color('amber-ink') });
        f.text(mark.x, track.y - 14, mark.text, { size: 11, serif: true, anchor: 'middle', hue: mark.seen ? 'amber' : 'ink-mute' });
      }
    }
  }
});
