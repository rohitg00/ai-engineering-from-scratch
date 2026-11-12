'use strict';

const { figure } = require('../../../_shared/figkit.js');

const rows = [
  {
    left: { hue: 'plum', title: 'Task', sub: 'a row in its own database' },
    right: { hue: 'green', title: 'Actor and ActorTemplate', sub: 'same name, files-only snapshot' },
    label: 'one to one',
    style: 'call',
  },
  {
    left: { hue: 'plum', title: 'Workspace', sub: 'inline files and Git repositories' },
    right: { hue: 'violet', title: 'ax-task-runner, PID 1', sub: 'writes files, then tries the clone' },
    label: 'at each start',
    style: 'call',
  },
  {
    left: { hue: 'plum', title: 'Gateway', sub: 'stored, 1 egress rule' },
    right: { hue: 'grey', title: 'no EgressPolicy', sub: 'spec.gateway: Unimplemented' },
    label: 'rejected',
    style: 'fail',
  },
  {
    left: { hue: 'plum', title: 'Model', sub: 'stored, the Secret is not checked' },
    right: { hue: 'grey', title: 'nothing on Substrate', sub: 'no task of ours used a model' },
    label: 'not run',
    style: 'fail',
  },
  {
    left: { hue: 'olive', title: 'ax resume, ax suspend', sub: 'the commands that you send' },
    right: { hue: 'blue', title: 'ResumeActor, SuspendActor', sub: '600 s idle: still RUNNING' },
    label: 'your call',
    style: 'call',
  },
  {
    left: { hue: 'grey', title: 'no worker selector', sub: 'the template names no pool' },
    right: { hue: 'violet', title: 'a WorkerPool of another team', sub: 'every task ran outside our pool' },
    label: 'any pool',
    style: 'fail',
  },
];

module.exports = figure('fig-7-5', {
  height: 472,
  title: 'What each Agent Executor object became on Agent Substrate in our run',
  desc: 'Six rows map Agent Executor to Agent Substrate, as recorded in our run of one commit on Substrate v1.0.0. A Task is a row in the Agent Executor database and became one actor and one template with the same name, a files-only snapshot, and a golden snapshot. A Workspace was prepared inside the sandbox by the task runner at each start. A Gateway was stored, but a task that named it was rejected with Unimplemented, so no egress policy existed. A Model was stored without a check of its Secret. The resume and suspend commands became the two Substrate calls, and a task with no request stayed RUNNING for 600 seconds. The template named no pool, and every task ran on a WorkerPool of another namespace.',
}, f => {
  f.kicker(20, 22, 'Agent Executor');
  f.kicker(380, 22, 'Agent Substrate');
  rows.forEach((row, index) => {
    const y = 34 + index * 72;
    const left = f.box({ x: 20, y, w: 240, h: 48, titleSize: 12, ...row.left });
    const right = f.box({ x: 380, y, w: 240, h: 48, titleSize: 12, ...row.right });
    f.arrow(left.right(), [right.x - 1, left.cy], { style: row.style, label: row.label });
  });
});
