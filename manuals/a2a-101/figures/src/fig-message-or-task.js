'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-message-or-task', {
  height: 396,
  title: 'One method, two result shapes',
  desc: 'The planner sends SendMessage to code-reviewer, and the agent logic decides the shape. A question with no text/x-diff part gets result.message, message 3b4b1206 in context dc423c62, and the client can only read its parts and send a new message in that context. A diff gets result.task, task e5c95b09 in context 49c5a238 in state TASK_STATE_INPUT_REQUIRED, and the client can answer with that taskId or follow the task with GetTask, SubscribeToTask, or CancelTask.',
}, f => {
  const send = f.box({ x: 170, y: 14, w: 300, h: 44, hue: 'violet', title: 'SendMessage', sub: 'planner to code-reviewer, one method' });

  f.beat(1);
  const decide = f.box({ x: 150, y: 86, w: 340, h: 54, hue: 'plum', title: 'code-reviewer decides', sub: ['a question with no text/x-diff part: a message', 'anything else: a task'] });
  f.arrow(send.bottom(), [send.cx, decide.y - 1], { style: 'call' });

  f.beat(2);
  const message = f.box({ x: 20, y: 192, w: 280, h: 58, hue: 'blue', title: 'result.message', sub: ['messageId 3b4b1206', 'contextId dc423c62, no task id'] });
  f.path(`M250 ${decide.y + decide.h} V164 H${message.cx} V${message.y - 1}`, { style: 'reply' });
  f.text(message.cx, 158, 'a question (02)', { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });

  f.beat(3);
  const task = f.box({ x: 340, y: 192, w: 280, h: 58, hue: 'amber', title: 'result.task', sub: ['id e5c95b09, contextId 49c5a238', 'TASK_STATE_INPUT_REQUIRED'] });
  f.path(`M390 ${decide.y + decide.h} V164 H${task.cx} V${task.y - 1}`, { style: 'reply' });
  f.text(task.cx, 158, 'a diff (06)', { size: 11, serif: true, hue: 'ink-soft', anchor: 'middle' });

  f.beat(4);
  f.kicker(176, 280, 'What the client can do next');
  const reuse = f.box({ x: 20, y: 290, w: 280, h: 46, hue: 'violet', title: 'a new SendMessage', sub: 'with contextId dc423c62 to continue' });
  f.arrow(message.bottom(), [message.cx, reuse.y - 1], { style: 'call' });
  f.text(20, 362, 'Nothing to poll, cancel, or subscribe to.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 378, 'The message is the whole answer.', { size: 11, serif: true, hue: 'ink-soft' });

  f.beat(5);
  const act = f.box({ x: 340, y: 290, w: 280, h: 82, hue: 'violet', title: 'act on task e5c95b09', sub: ['SendMessage with its taskId answers', 'GetTask and SubscribeToTask follow it', 'CancelTask asks to stop it'] });
  f.arrow(task.bottom(), [task.cx, act.y - 1], { style: 'call' });
});
