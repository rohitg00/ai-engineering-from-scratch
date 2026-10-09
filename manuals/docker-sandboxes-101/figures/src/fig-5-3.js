'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

const fsNames = ['directory_tree, edit_file,', 'list_directory, read_file,', 'read_multiple_files,', 'search_files_content,', 'write_file, create_directory,', 'remove_directory'];

const mcpRows = [
  { y: 236, entry: 'ref: docker:duckduckgo', runtime: 'MCP Gateway', how: 'server in a container' },
  { y: 298, entry: 'command, args, env', runtime: 'child process', how: 'stdio, aqua install' },
  { y: 360, entry: 'remote.url', runtime: 'network endpoint', how: 'streamable or sse' },
];

module.exports = figure('fig-5-3', {
  height: 424,
  title: 'What each toolset entry gives the model',
  desc: 'Three columns: the toolsets entry in the agent file, what the runtime starts for it, and the tool names that arrive in the model request. Captured rows: type filesystem is a built-in toolset in the docker-agent process and gives nine tools, directory_tree, edit_file, list_directory, read_file, read_multiple_files, search_files_content, write_file, create_directory and remove_directory; type shell gives one tool, shell, with cmd, cwd and timeout, one command per call. Rows from the docs, not run: type mcp with ref docker:duckduckgo runs a catalog server in a container through the MCP Gateway, type mcp with command, args and env starts a child process over stdio with aqua auto-install, and type mcp with remote.url reaches a network endpoint over streamable HTTP or SSE; each gives the tools its server lists.',
}, f => {
  f.kicker(20, 18, 'agent file entry');
  f.kicker(215, 18, 'what runs');
  f.kicker(400, 18, 'tool names the model gets');

  const fsEntry = f.box({ x: 20, y: 30, w: 170, h: 104, hue: 'violet', title: 'type: filesystem', sub: ['files.yaml'] });
  const fsRun = f.box({ x: 215, y: 30, w: 160, h: 104, hue: 'olive', title: 'built-in toolset', sub: ['inside the', 'docker-agent process'] });
  f.rect(400, 30, 220, 104, { fill: color('olive-fill'), stroke: color('olive-ink') });
  fsNames.forEach((line, index) => f.text(410, 50 + index * 15, line, { size: 11 }));
  f.arrow(fsEntry.right(), [fsRun.x - 1, fsEntry.cy], { style: 'call' });
  f.arrow(fsRun.right(), [399, fsEntry.cy], { style: 'reply' });

  const shEntry = f.box({ x: 20, y: 146, w: 170, h: 52, hue: 'violet', title: 'type: shell', sub: ['files.yaml, guarded.yaml'] });
  const shRun = f.box({ x: 215, y: 146, w: 160, h: 52, hue: 'olive', title: 'built-in toolset', sub: ['one command per call'] });
  const shTool = f.box({ x: 400, y: 146, w: 220, h: 52, hue: 'olive', title: 'shell', sub: ['cmd, cwd, timeout (30 s)'] });
  f.arrow(shEntry.right(), [shRun.x - 1, shEntry.cy], { style: 'call' });
  f.arrow(shRun.right(), [shTool.x - 1, shEntry.cy], { style: 'reply' });

  f.kicker(20, 226, 'three forms of type: mcp, from the docs, not run');
  for (const row of mcpRows) {
    const entry = f.box({ x: 20, y: row.y, w: 170, h: 52, hue: 'violet', dash: 'dashed', title: 'type: mcp', sub: [row.entry] });
    const run = f.box({ x: 215, y: row.y, w: 160, h: 52, hue: 'olive', dash: 'dashed', title: row.runtime, sub: [row.how] });
    const tools = f.box({ x: 400, y: row.y, w: 220, h: 52, hue: 'olive', dash: 'dashed', title: 'the server\'s tools', sub: ['names from tools/list'] });
    f.arrow(entry.right(), [run.x - 1, entry.cy], { style: 'call' });
    f.arrow(run.right(), [tools.x - 1, entry.cy], { style: 'reply' });
  }
});
