# serve api and serve chat

> `serve api` is the native control plane, with sessions and an SSE run stream on port 8080, and `serve chat` is the OpenAI-compatible subset on port 8083.

Your agent file answers well in a terminal, and now a web page and a CI job must call it over HTTP. The page wants every event of a turn, and the CI job speaks only the OpenAI chat format.

When you finish this section, you can start both servers on one agent file, run one turn through each, and read the event stream.

## One agent file, five servers

The `a2a`, `acp`, `api`, and `mcp` commands moved under `serve` in v1.23.4 {{rel-agent v1.23.4}}, and v1.53.0 added `chat` {{rel-agent v1.53.0}}. The help of v1.149.0 lists all five {{help-agent docker-agent serve}}. This part serves one small file all five ways. Its one agent, `root`, answers every message with the word pong:

```listing
title: the agent file served in sections 6.1 to 6.3
source: capture/fixtures/agents/pong.yaml
lang: yaml
---
version: "16"

agents:
  root:
    model: local
    description: Answers every message with the word pong.
    instruction: Reply with exactly the word pong and nothing else.

models:
  local:
    provider: dmr
    model: ai/qwen3:4b
    temperature: 0
```

## serve api: a session, then a run

**serve api:** the command that "exposes your agents through a REST-style API with Server-Sent Events (SSE) streaming" {{docs-agent API Server}}. It listens on `127.0.0.1:8080`, and an empty `--auth-token` means no authentication {{help-agent docker-agent serve api}}. `--max-request-size` rejects a body over 1 MiB with HTTP 413, and `--session-workingdir-root` confines the `working_dir` of new sessions {{help-agent docker-agent serve api}}.

The session database has a different default here. `serve api -s` writes `session.db` in the current directory, while `run`, `serve a2a`, and `serve acp` use `<data-dir>/session.db` {{help-agent docker-agent serve api}} ([conflict C63](#s-ref-sources-and-the-conflicts-register)). The capture passed `-s work/api-session.db` and `--fake work/cassettes/23-api`, so a recorded cassette gave the model answer (capture/out/23-serve-api.log).

```listing
title: list the agents, create a session, start a run
source: capture/out/23-api.http
lang: http
note: The ping exchange, the final session read, the Host and Date headers, and most fields of the session object are cut.
---
GET /api/agents HTTP/1.1
…
    "name": "pong",
    "description": "Answers every message with the word pong.",
    "multi": false
…
POST /api/sessions HTTP/1.1
…
{}
…
  "id": "<uuid>",
  "origin": "run",
…
  "tools_approved": false,
…
POST /api/sessions/<uuid>/agent/pong HTTP/1.1
…
Accept: text/event-stream
…
      "role": "user",
      "content": "ping"
…
HTTP/1.1 200 OK
…
Content-Type: text/event-stream
```

The agent identifier in the path is the file name without `.yaml`, so `pong`, while the events name the agent `root` {{docs-agent API Server}}. The run body is a `messages` array with an optional `model` field, which sets a model override for that agent in the session {{docs-agent API Server}}. A new session has `tools_approved: false`. A tool call then raises `tool_call_confirmation`, and the client answers with `POST /api/sessions/:id/resume` {{docs-agent API Server}}.

## The run stream

```listing
title: the ten frames of one turn
source: capture/out/23-api-run.sse
lang: sse
note: The usage object of the token_usage frame is cut. The kit dropped the reasoning frames before it wrote the file.
---
data: {"agent_name": "root", "available_agents": [{"description": "Answers every message with the word pong.", "model": "ai/qwen3:4b", "name": "root", "provider": "dmr"}], "current_agent": "root", "timestamp": "<ts>", "type": "team_info"}
data: {"agent_name": "root", "available_tools": 0, "loading": false, "timestamp": "<ts>", "type": "toolset_info"}
data: {"message": "ping", "session_id": "<uuid>", "session_position": 0, "timestamp": "<ts>", "type": "user_message"}
data: {"agent_name": "root", "session_id": "<uuid>", "timestamp": "<ts>", "type": "stream_started"}
data: {"agent_name": "root", "available_tools": 0, "loading": false, "timestamp": "<ts>", "type": "toolset_info"}
data: {"agent_name": "root", "description": "Answers every message with the word pong.", "model": "dmr/ai/qwen3:4b", "timestamp": "<ts>", "type": "agent_info"}
data: {"agent_name": "root", "content": "pong", "message_id": "<uuid>", "session_id": "<uuid>", "timestamp": "<ts>", "type": "agent_choice"}
data: {"agent_name": "root", "session_id": "<uuid>", "timestamp": "<ts>", "type": "message_added"}
data: {"agent_name": "root", "session_id": "<uuid>", "timestamp": "<ts>", "type": "token_usage", …}
data: {"agent_name": "root", "finish_reason": "stop", "reason": "normal", "session_id": "<uuid>", "timestamp": "<ts>", "type": "stream_stopped"}
```

The docs list eight event types, from `stream_started` to `error` {{docs-agent API Server}}. The capture adds six more: `team_info`, `toolset_info`, `user_message`, `agent_info`, `message_added`, and `token_usage`. The pong agent has no tools, so no `tool_call` frame appears. The last request of the file reads the session back, and the stored assistant message keeps the model's `reasoning_content` beside the answer (capture/out/23-api.http). [Figure](#fig-6-1) draws the whole exchange.

```figure
id: fig-6-1
kind: sequence
title: one serve api session and one streamed run
claim: A session is created first and stored, and one POST to the agent path returns the whole turn as SSE frames from team_info to stream_stopped.
caption: Read top to bottom. Solid ink arrows are requests and dashed ink arrows are replies. Dotted indigo arrows are SSE frames, the teal arrow stores the session, and the plum arrow is the model call that the cassette answers. From capture/out/23-api.http and 23-api-run.sse.
```

A run is one request, and the session outlives it. `/steer` injects messages into a running turn, `/followup` queues them with an optional `Idempotency-Key`, and `/fork` copies a session up to a user message {{docs-agent API Server}}. `GET /api/sessions/:id/events` is a session-wide stream that resumes from `Last-Event-ID` or `?since=` {{docs-agent API Server}}. An interactive `docker-agent run --listen ADDR` serves the same control plane, with a fixed 1 MiB body limit and no `--auth-token`. The help does not list that flag, and each such run writes `<data-dir>/runs/<pid>.json` for discovery {{docs-agent API Server}}.

## serve chat: the OpenAI-compatible subset

**serve chat:** the command that "exposes the agent through an OpenAI-compatible API at /v1/chat/completions and /v1/models" {{help-agent docker-agent serve chat}}. The model id is the agent name, so the capture lists `root`, the name inside the file, where `serve api` used `pong`, the file name.

```listing
title: the model list, one completion, and a request without the token
source: capture/out/23-chat.http
lang: http
note: Headers, ids, timestamps, and the usage object are cut.
---
GET /v1/models HTTP/1.1
…
Authorization: Bearer m101-chat-key
…
      "id": "root",
…
      "owned_by": "docker-agent",
…
POST /v1/chat/completions HTTP/1.1
…
        "role": "assistant",
        "content": "pong"
…
HTTP/1.1 401 Unauthorized
…
    "message": "missing or invalid bearer token",
```

By default the server keeps no conversation, so each request carries the full history. `--conversations-max` caches up to N conversations keyed by `X-Conversation-Id`, and `--conversation-ttl` evicts them after 30 minutes {{help-agent docker-agent serve chat}}. A failed turn leaves a cached conversation unchanged, so a client can retry with the same id {{docs-agent Chat Server}}. With `stream: true` in the body, the reply is an SSE stream of `chat.completion.chunk` deltas {{docs-agent Chat Server}}. `--max-idle-runtimes` keeps four idle runtimes per agent, and `--request-timeout` bounds each request at five minutes, model and tool calls included {{help-agent docker-agent serve chat}}. A listener that is not on loopback needs `--api-key`, `--api-key-env`, or `--insecure-no-auth` {{docs-agent Chat Server}}.

| | `serve api` | `serve chat` |
|---|---|---|
| Default address | `127.0.0.1:8080` | `127.0.0.1:8083` |
| Token flag | `--auth-token` | `--api-key` or `--api-key-env` |
| Agent id in the capture | `pong`, the file name | `root`, the agent name |
| State | sessions in `-s`, default `session.db` | none, or a cache keyed by `X-Conversation-Id` |
| Tool approval | `tool_call_confirmation`, then `resume` | `--safety`, default `restricted` {{docs-agent Chat Server}} |
| Cassettes | `--fake` and `--record` | none |

```takeaways
- Use `serve api` when the client must see tool confirmations and every stream event.
- Use `serve chat` for clients that speak only the OpenAI chat format.
- Pass `-s` to `serve api`, or it writes `session.db` into the current directory.
- Set a token before you bind either server to an address that is not loopback.
```

Sources: help-agent docker-agent serve, serve api, serve chat (research/sources/help-docker-agent.md); docs-agent API Server, Chat Server (research/sources/docs-docker-agent.md); rel-agent v1.23.4, v1.53.0 (research/sources/docker-agent-CHANGELOG.md); research/conflicts-register.md row C63; research/plan.md, Part 6; capture/README.md; capture/fixtures/agents/pong.yaml; capture/out/23-serve-api.log, 23-api.http, 23-api-run.sse, 23-chat.http
