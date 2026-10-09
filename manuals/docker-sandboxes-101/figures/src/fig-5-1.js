'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-5-1', {
  height: 372,
  title: 'One docker-agent run from the agent file to its outputs',
  desc: 'Top row: capture/fixtures/agents/files.yaml with one agent root, the model local, and two toolsets is loaded by docker-agent run with the exec flag and two messages; without exec the same run draws the TUI. Middle row: the agent loop of root sends model calls to dmr/ai/qwen3:4b on Model Runner at localhost:12434 and tool calls to the ten tools of filesystem and shell. Bottom row: the loop writes the final answer to stdout, 67 NDJSON events with the json flag, and one session to session.db. The record flag writes the model exchanges to the cassette 18-files.yaml, and the fake flag replays them in place of Model Runner.',
}, f => {
  f.kicker(20, 18, 'one run of capture/fixtures/agents/files.yaml');
  const file = f.box({ x: 20, y: 34, w: 165, h: 56, hue: 'violet', title: 'files.yaml', sub: ['one agent, root', 'model local, 2 toolsets'] });
  const run = f.box({ x: 237, y: 34, w: 165, h: 56, hue: 'violet', title: 'docker-agent run', sub: ['--exec, two messages'] });
  const tui = f.box({ x: 455, y: 34, w: 165, h: 56, hue: 'grey', dash: 'dashed', title: 'TUI', sub: ['without --exec'] });
  f.arrow(file.right(), [run.x - 1, file.cy], { style: 'call', label: 'loads' });
  f.arrow(run.right(), [tui.x - 1, run.cy], { style: 'reply' });

  const model = f.box({ x: 20, y: 150, w: 165, h: 60, hue: 'plum', title: 'dmr/ai/qwen3:4b', sub: ['Model Runner', 'localhost:12434'] });
  const loop = f.box({ x: 237, y: 150, w: 165, h: 60, hue: 'violet', title: 'agent loop: root', sub: ['one turn per model call'] });
  const tools = f.box({ x: 455, y: 150, w: 165, h: 60, hue: 'olive', title: 'filesystem, shell', sub: ['10 tools, such as', 'list_directory, shell'] });
  f.arrow([run.cx, 90], [run.cx, 149], { style: 'call', label: 'turn 1, turn 2' });
  f.arrow([loop.x, 170], [model.x + model.w + 1, 170], { style: 'model' });
  f.arrow([model.x + model.w, 190], [loop.x - 1, 190], { style: 'reply' });
  f.arrow([loop.x + loop.w, 170], [tools.x - 1, 170], { style: 'effect' });
  f.arrow([tools.x, 190], [loop.x + loop.w + 1, 190], { style: 'reply' });

  const cassette = f.box({ x: 20, y: 276, w: 140, h: 56, hue: 'teal', title: '18-files.yaml', sub: ['the cassette'] });
  const stdout = f.box({ x: 175, y: 276, w: 140, h: 56, hue: 'grey', title: 'stdout', sub: ['final answer only', 'with --last'] });
  const events = f.box({ x: 330, y: 276, w: 140, h: 56, hue: 'indigo', title: '--json', sub: ['NDJSON, 67 events'] });
  const db = f.box({ x: 485, y: 276, w: 135, h: 56, hue: 'teal', title: 'session.db', sub: ['a session per run'] });
  f.arrow([60, 210], [60, 275], { style: 'write', label: '--record' });
  f.arrow([140, 275], [140, 211], { style: 'reply', label: '--fake' });
  f.arrow([270, 210], [stdout.cx, 275], { style: 'reply' });
  f.arrow([370, 210], [events.cx, 275], { style: 'event' });
  f.arrow([402, 204], [db.cx, 275], { style: 'write' });
  f.text(20, 360, 'Dashed box: not run in the capture. Every solid box is in capture/out/18-*.', { size: 11, serif: true, hue: 'ink-soft' });
});
