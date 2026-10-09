# serve mcp and serve acp

> `serve mcp` exposes each agent as one MCP tool over stdio or streaming HTTP on port 8081, and `serve acp` speaks the Agent Client Protocol to an editor over stdio.

Your MCP client already calls tools, and your editor already talks to coding agents. Neither of them reads an agent file. `serve mcp` turns the agent into a tool for the first, and `serve acp` turns it into an editor agent for the second.

When you finish this section, you can serve an agent as an MCP tool, read its schema, and open an ACP session from an editor.

## serve mcp: one agent, one tool

**serve mcp:** "Start an MCP server that exposes the agent via the Model Context Protocol. By default, uses stdio transport" {{help-agent docker-agent serve mcp}}. `--http` switches to streaming HTTP on `127.0.0.1:8081`. Without `-a`, every agent of a team file becomes its own tool, and `--tool-name` renames the tool when one agent is exposed {{help-agent docker-agent serve mcp}}.

`--attach` exposes the session of a running TUI, found by pid, address, or session id. `--mcp-keepalive` works over stdio only, while `--auth-token`, `--insecure-no-auth`, and `--safety` work with `--http` only {{help-agent docker-agent serve mcp}}. Over HTTP the safety policy defaults to `restricted` {{docs-agent MCP Mode}}.

The capture ran `serve mcp fixtures/agents/pong.yaml --http --listen 127.0.0.1:8081 --tool-name pong`, with the file of [serve api and serve chat](#s-serve-api-and-serve-chat):

```listing
title: initialize, tools/list, and tools/call against /mcp
source: capture/out/23-mcp.http
lang: http
note: Headers, the client info, and the notifications/initialized exchange are cut. The tools/list line is cut inside the tool definition.
---
POST /mcp HTTP/1.1
…
  "method": "initialize",
  "params": {
    "protocolVersion": "2026-07-28",
…
Content-Type: text/event-stream
…
event: message
data: {"jsonrpc":"2.0","id":1,"result":{"capabilities":{"logging":{},"tools":{"listChanged":true}},"protocolVersion":"2025-11-25","serverInfo":{"name":"docker agent","version":"v1.149.0"}}}
…
data: {"jsonrpc":"2.0","id":2,"result":{"ttlMs":0,"cacheScope":"public","tools":[{"annotations":{"destructiveHint":false,"idempotentHint":true,"openWorldHint":false,"readOnlyHint":true,…"inputSchema":{…"properties":{"message":{"description":"the message to send to the agent","type":"string"}},"required":["message"],"type":"object"},"name":"pong","outputSchema":{…
…
data: {"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"{\"response\":\"pong\"}"}],"structuredContent":{"response":"pong"}}}
```

The client asked for revision `2026-07-28`, which v1.129.0 added with "stateless Streamable HTTP transport" {{rel-agent v1.129.0}}. The server answered `2025-11-25`, so read the version from the result, never from your request. No response carried an `Mcp-Session-Id` header. Each answer came as one SSE `message` event, and the notification got `202 Accepted` (capture/out/23-mcp.http).

The tool takes one string, `message`, and returns `structuredContent.response`, with the same text as a JSON string in `content`. Its annotations mark it read-only and idempotent, and its title is the agent's `description`. The `tools/call` answer came as one event after the whole turn, with no progress notification before it. The kit README adds that the server answered on `/` as well as `/mcp` (capture/README.md). The docs register the stdio form in Claude Code with `claude mcp add --transport stdio`, followed by `-- docker agent serve mcp` and the agent reference {{docs-agent MCP Mode}}.

## serve acp: JSON-RPC lines to an editor

**serve acp:** a server that "communicates over stdio (standard input/output)" {{docs-agent ACP}}. The editor spawns `docker-agent serve acp FILE`, writes JSON-RPC requests to its stdin, and reads responses and notifications from its stdout. Sessions persist in `<data-dir>/session.db` unless `-s` names another file {{help-agent docker-agent serve acp}}. A team file works as well, and the docs say its sub-agents need no change for ACP {{docs-agent ACP}}.

```listing
title: initialize and session/new over stdio
source: capture/out/23-acp.jsonl
lang: jsonl
note: Lines marked >> were written to stdin, lines marked << were read from stdout. Each object is cut inside, at each mark.
---
>> {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": 1, …}}
<< {"id": 1, "jsonrpc": "2.0", "result": {"agentCapabilities": {"auth": {"logout": {}}, "loadSession": true, …, "agentInfo": {"name": "docker agent", "title": "docker agent", "version": "v1.149.0"}, …, "protocolVersion": 1}}
>> {"jsonrpc": "2.0", "id": 2, "method": "session/new", "params": {"cwd": "$CAPTURE", "mcpServers": []}}
<< {"jsonrpc": "2.0", "method": "session/update", "params": {"sessionId": "<uuid>", "update": {"availableCommands": [{"description": "Summarize and compact session history", …, "name": "compact"}, {"description": "Display current context token usage and session cost", "name": "usage"}], "sessionUpdate": "available_commands_update"}}}
<< {"id": 2, "jsonrpc": "2.0", "result": {"configOptions": [{"category": "mode", "currentValue": "default", …}], "modes": {…, "currentModeId": "default"}, "sessionId": "<uuid>"}}
```

`initialize` returns `agentCapabilities`: `loadSession`, MCP servers over HTTP and SSE, audio, image, and embedded-context prompts, and the session operations `close`, `delete`, `list`, and `resume`. It offers one auth method, `host-credentials`, which v1.144.0 added together with session deletion {{rel-agent v1.144.0}}. Before the `session/new` result, a `session/update` notification lists the slash commands. Release v1.143.0 announced `/compact`, `/usage`, and `/new` {{rel-agent v1.143.0}}, and the captured list has no `new`.

The session starts in mode `default`, which auto-approves read-only tools and asks for the rest. The mode list adds `default` to the four values of `--safety`. A client changes the mode with `session/set_config_option` or the older `session/set_mode` {{rel-agent v1.144.0}}. The capture stops at `session/new`, so it shows no prompt turn over ACP. The docs sketch the host side with a method `agent/run` and call that code pseudocode {{docs-agent ACP}}. Use the method names of the capture.

```figure
id: fig-6-2
kind: flow
title: one agent file served over ACP and over MCP
claim: The same pong.yaml answers an editor through stdin and stdout and an MCP client through HTTP POSTs to port 8081, with different method names on each path.
caption: Read each band left to right. The boxes under each band list the captured messages in order, with >> for a request and << for a response or notification. From capture/out/23-acp.jsonl and 23-mcp.http.
```

For the protocol under `serve mcp`, read [the MCP transports lesson](phases/13-tools-and-protocols/09-mcp-transports).

```takeaways
- Read `protocolVersion` from the `initialize` result, never from your own request.
- Give a served agent a `--tool-name` that says what the tool does.
- Set `--safety` and `--auth-token` on `serve mcp --http`, because stdio takes neither.
- Pick the ACP mode per session with `session/set_config_option`.
```

Sources: help-agent docker-agent serve mcp, serve acp (research/sources/help-docker-agent.md); docs-agent MCP Mode, ACP (research/sources/docs-docker-agent.md); rel-agent v1.129.0, v1.143.0, v1.144.0 (research/sources/docker-agent-CHANGELOG.md); research/plan.md, Part 6; capture/README.md; capture/fixtures/agents/pong.yaml; capture/out/23-mcp.http, 23-acp.jsonl
