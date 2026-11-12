'use strict';

const { figure } = require('../../../_shared/figkit.js');

const rows = [
  {
    left: { hue: 'plum', title: 'Task', sub: 'image, command, limits, env' },
    right: { hue: 'green', title: 'one Actor, same name', sub: 'template: files-only snapshot' },
    label: 'one to one',
    style: 'call',
  },
  {
    left: { hue: 'plum', title: 'Workspace', sub: 'git repos, MCP servers, skills' },
    right: { hue: 'violet', title: 'ax-task-runner, PID 1', sub: 'prepares it at the first resume' },
    label: 'in the sandbox',
    style: 'call',
  },
  {
    left: { hue: 'plum', title: 'Gateway', sub: 'egress rules' },
    right: { hue: 'indigo', title: 'EgressPolicy of the actor', sub: 'copied when the task is created' },
    label: 'copied',
    style: 'call',
  },
  {
    left: { hue: 'olive', title: 'ax resume, ax suspend', sub: 'the commands that you send' },
    right: { hue: 'blue', title: 'ResumeActor, SuspendActor', sub: 'no idle timer in the code' },
    label: 'your call',
    style: 'call',
  },
  {
    left: { hue: 'grey', title: 'nothing in Agent Executor', sub: 'the install does not make a pool' },
    right: { hue: 'violet', title: 'WorkerPool', sub: 'you create it, or a resume fails' },
    label: 'your job',
    style: 'fail',
  },
];

module.exports = figure('fig-7-5', {
  height: 400,
  title: 'What each Agent Executor object becomes on Agent Substrate',
  desc: 'Five rows map Agent Executor to Agent Substrate, as read from the Agent Executor code and documentation and not from a run. A Task becomes one actor with the same name and a files-only snapshot. A Workspace is prepared inside the sandbox by the task runner. Gateway rules are copied into the egress policy of the actor. The resume and suspend commands become the two Substrate calls. No WorkerPool is created for you.',
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
