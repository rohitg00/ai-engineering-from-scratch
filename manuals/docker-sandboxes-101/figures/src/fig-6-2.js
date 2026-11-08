'use strict';

const { figure, color } = require('../../../_shared/figkit.js');

function exchange(f, y, lines) {
  const h = lines.length * 18 + 12;
  f.rect(20, y, 400, h, { fill: color('paper'), stroke: color('panel-edge') });
  lines.forEach((line, index) => f.text(32, y + 20 + index * 18, line, { size: 11 }));
  return y + h;
}

module.exports = figure('fig-6-2', {
  height: 396,
  title: 'One agent file served over ACP and over MCP',
  desc: 'Top band: an editor spawns docker-agent serve acp pong.yaml and writes JSON-RPC lines to its stdin. initialize returns agentCapabilities and agentInfo docker agent v1.149.0 at protocolVersion 1. session/new first sends a session/update notification with the slash commands compact and usage, then the result with configOptions and the mode default. Bottom band: curl posts to serve mcp --http at 127.0.0.1:8081/mcp. initialize asks for 2026-07-28 and gets 2025-11-25, notifications/initialized gets 202 Accepted, tools/list returns one tool named pong with one message argument, and tools/call returns structuredContent.response pong. Both servers run the agent root of pong.yaml on dmr/ai/qwen3:4b.',
}, f => {
  f.kicker(20, 20, 'ACP over stdio');
  const editor = f.box({ x: 20, y: 30, w: 130, h: 48, hue: 'grey', title: 'editor', sub: 'ACP client' });
  const acp = f.box({ x: 250, y: 30, w: 170, h: 48, hue: 'indigo', title: 'serve acp', sub: 'stdin and stdout' });
  f.arrow(editor.right(), [acp.x - 1, editor.cy], { style: 'call', label: 'stdio' });
  exchange(f, 90, [
    '>> initialize, protocolVersion 1',
    '<< agentCapabilities, agentInfo docker agent',
    '>> session/new, cwd, mcpServers []',
    '<< session/update: commands compact, usage',
    '<< result: configOptions, currentModeId default',
  ]);

  f.kicker(20, 214, 'MCP over streaming HTTP');
  const curl = f.box({ x: 20, y: 224, w: 130, h: 48, hue: 'grey', title: 'curl', sub: 'MCP client' });
  const mcp = f.box({ x: 250, y: 224, w: 170, h: 48, hue: 'indigo', title: 'serve mcp --http', sub: '127.0.0.1:8081/mcp' });
  f.arrow(curl.right(), [mcp.x - 1, curl.cy], { style: 'call', label: 'HTTP POST' });
  exchange(f, 284, [
    '>> initialize, asks 2026-07-28',
    '<< protocolVersion 2025-11-25',
    '>> notifications/initialized, 202 Accepted',
    '>> tools/list << one tool pong(message)',
    '>> tools/call << structuredContent.response',
  ]);

  const agent = f.box({ x: 470, y: 30, w: 150, h: 354, hue: 'violet', title: 'pong.yaml', sub: ['agent root', 'dmr/ai/qwen3:4b', 'temperature 0'] });
  f.arrow(acp.right(), [agent.x - 1, acp.cy], { style: 'call' });
  f.arrow(mcp.right(), [agent.x - 1, mcp.cy], { style: 'call' });
});
