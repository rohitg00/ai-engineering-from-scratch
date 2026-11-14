'use strict';

const { figure } = require('../../../_shared/figkit.js');

const rows = [
  ["MCPAdapter('server.py')", 'a string that is not a URL', 'ValueError, no launch', 'refused at construction', 'rose'],
  ['tool reports isError', 'ToolError in the server', 'ToolMessage, status error', 'the run goes on', 'green'],
  ['exception in the tool', 'RuntimeError in the server', 'ToolMessage, status error', 'the run goes on', 'green'],
  ['slow tool, default client', 'slow(2) waits 2.0 s', 'ToolMessage, status success', 'the adapter has no timeout', 'grey'],
  ['slow tool, Client(timeout=1)', 'slow(5) over stdio or HTTP', 'MCPError: timed out', 'raised after 1.0 s', 'rose'],
  ['server crash, stdio', 'os._exit(3) mid-call', 'MCPError: Connection closed', 'run aborts, next call relaunches', 'rose'],
  ['server crash, HTTP', 'os._exit(3) mid-call', 'RemoteProtocolError', 'then runs fail to connect', 'rose'],
];

module.exports = figure('fig-6-2', {
  height: 470,
  title: 'What each MCP failure does to a run',
  desc: 'Seven rows, each from a case on the left to its result on the right. A string target that is not an http or https URL raises ValueError and launches nothing. A tool that reports isError and a tool that raises a Python exception both become a ToolMessage with status error, and the run goes on. A slow tool with the default client returns after 2.0 seconds, because the adapter has no timeout. A FastMCP Client with timeout 1 raises MCPError timed out after 1.0 seconds. A server crash over stdio raises MCPError Connection closed and aborts the run, and the next call starts the server again. A server crash over HTTP raises RemoteProtocolError on the call, and the agent run and later calls then fail to connect, because nothing starts the server again.',
}, f => {
  f.kicker(20, 20, 'the case');
  f.kicker(360, 20, 'what the run gets');
  rows.forEach(([kind, detail, result, after, hue], i) => {
    const y = 32 + i * 60;
    const left = f.box({ x: 20, y, w: 270, h: 48, hue: 'grey', title: kind, sub: detail, align: 'left' });
    const right = f.box({ x: 360, y, w: 260, h: 48, hue, title: result, sub: after, align: 'left' });
    f.arrow(left.right(), [right.x - 1, left.cy], { style: hue === 'rose' ? 'fail' : 'reply' });
  });
  f.text(20, 462, 'From the Mac, one run of each case, langchain 1.5.0 with fastmcp 4.2.0.', { size: 11, serif: true, hue: 'ink-soft' });
});
