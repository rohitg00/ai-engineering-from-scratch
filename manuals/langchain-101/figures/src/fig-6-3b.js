'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-6-3b', {
  height: 400,
  title: 'The tools and state that create_deep_agent adds',
  desc: 'The capture called create_deep_agent with the fake model, the add tool, and the system prompt You keep notes. The main agent was bound nine tools: ls, read_file, write_file, edit_file, delete, glob, and grep from FilesystemMiddleware, task from SubAgentMiddleware, and add from the caller. Its state gained a files channel that held /notes.md. The task tool started the general-purpose subagent, which was bound the same tools without task, and whose system prompt had 286 characters. The graph gained two middleware nodes, PatchToolCallsMiddleware.before_agent and _ParentNotifierMiddleware.after_agent. There is no write_todos tool and no execute tool.',
}, f => {
  f.box({ x: 20, y: 14, w: 600, h: 44, hue: 'violet', title: 'create_deep_agent(model=fake, tools=[add], system_prompt="You keep notes.")', titleSize: 11.5, sub: 'your call' });
  f.kicker(20, 84, 'tools bound on each main model call: 9');
  f.box({ x: 20, y: 96, w: 300, h: 60, hue: 'green', title: 'FilesystemMiddleware', sub: ['ls, read_file, write_file, edit_file,', 'delete, glob, grep'], align: 'left' });
  const task = f.box({ x: 336, y: 96, w: 140, h: 60, hue: 'green', title: 'SubAgent', sub: ['Middleware', 'task'], align: 'left' });
  f.box({ x: 492, y: 96, w: 128, h: 60, hue: 'violet', title: 'yours', sub: ['add'], align: 'left' });
  f.kicker(20, 186, 'state and graph');
  f.box({ x: 20, y: 198, w: 300, h: 60, hue: 'teal', title: 'files channel in state', sub: ['/notes.md: content, encoding,', 'created_at, modified_at'], align: 'left' });
  f.box({ x: 336, y: 198, w: 284, h: 60, hue: 'indigo', title: 'two middleware nodes', sub: ['PatchToolCallsMiddleware.before_agent', '_ParentNotifierMiddleware.after_agent'], align: 'left' });
  const sub = f.box({ x: 336, y: 300, w: 284, h: 60, hue: 'blue', title: 'general-purpose subagent', sub: ['8 tools: the same, without task', 'its own prompt, 286 characters'], align: 'left' });
  f.path(`M${task.cx} ${task.y + task.h} V178 H628 V${sub.cy} H${sub.x + sub.w + 1}`, { style: 'call' });
  f.text(20, 318, 'Not bound at 0.7.38:', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 336, 'write_todos, now opt-in, and', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 354, 'execute, which the docstring lists.', { size: 11, serif: true, hue: 'ink-soft' });
  f.text(20, 390, 'From the kit run on the fake model: call 4 is the subagent.', { size: 11, serif: true, hue: 'ink-soft' });
});
