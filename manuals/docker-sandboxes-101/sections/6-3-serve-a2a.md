# serve a2a

> `serve a2a` publishes an A2A 1.0 agent card on port 8082 and answers `SendMessage` with a completed task, and its card breaks three REQUIRED rules of A2A 1.0.1.

A planner on another team speaks A2A and wants to give your agent work. It will fetch a card, send one message, and read a task, as the A2A 101 manual teaches in [SendMessage](manuals/a2a-101/sections/4-1-send-message.md).

When you finish this section, you can serve an agent over A2A, call it with 1.0 names, and predict where a strict client objects.

## The card at the well-known path

**serve a2a:** "Start an A2A server that exposes the agent via the Agent-to-Agent protocol" {{help-agent docker-agent serve a2a}}. It listens on `127.0.0.1:8082`, and `-a` "defaults to the team's first agent" {{help-agent docker-agent serve a2a}}, where the legacy plugin named `root` ([conflict C64](#s-ref-sources-and-the-conflicts-register)). `--auth-token` covers the card and every invocation, and a listener off loopback needs it or `--insecure-no-auth` {{docs-agent A2A Protocol}}. Sessions default to the `restricted` safety policy {{docs-agent A2A Protocol}}.

The Docker Agent docs name neither the card path nor the protocol version ([conflict C71](#s-ref-sources-and-the-conflicts-register)). The capture found the card at `/.well-known/agent-card.json`. `/.well-known/agent.json` answered 404, and so did a POST to `/` (capture/README.md).

```listing
title: the agent card that serve a2a published for pong.yaml
source: capture/out/23-agent-card.json
lang: json
---
{
  "supportedInterfaces": [
    {
      "url": "http://127.0.0.1:8082/invoke",
      "protocolBinding": "JSONRPC",
      "protocolVersion": "1.0"
    }
  ],
  "capabilities": {
    "streaming": true
  },
  "defaultInputModes": [],
  "defaultOutputModes": [],
  "description": "Answers every message with the word pong.",
  "name": "pong",
  "skills": [
    {
      "description": "Answers every message with the word pong.",
      "id": "pong_",
      "name": "",
      "tags": [
        "llm",
        "docker agent"
      ]
    }
  ],
  "version": "v1.149.0"
}
```

The card names the file, `pong`, where `serve chat` used the agent name `root`. Its one skill has the id `pong_` and the description of the agent. The response also carried `Access-Control-Allow-Origin: *`, although the run set no `--cors-origin` and the help says "empty disables CORS" {{help-agent docker-agent serve a2a}}.

## SendMessage and GetTask

The card points to one JSON-RPC interface, `http://127.0.0.1:8082/invoke`, at protocol version `1.0`. The capture sent `SendMessage` there with `A2A-Version: 1.0` and no `configuration`:

```listing
title: SendMessage with the 1.0 names, then GetTask
source: capture/out/23-a2a.http
lang: http
note: Headers, ids, the history, the metadata, and the GetTask reply are cut.
---
POST /invoke HTTP/1.1
…
A2A-Version: 1.0
…
  "method": "SendMessage",
  "params": {
    "message": {
      "messageId": "m101-0001",
      "role": "ROLE_USER",
      "parts": [
        {
          "text": "ping"
        }
…
  "result": {
    "task": {
…
      "artifacts": [
        {
          "artifactId": "<uuid>",
          "metadata": {
            "adk_partial": true
          },
          "parts": [
            {
              "data": {},
…
        {
          "artifactId": "<uuid>",
          "parts": [
            {
              "text": "pong"
…
      "status": {
        "state": "TASK_STATE_COMPLETED",
…
  "method": "GetTask",
  "params": {
    "id": "<uuid>"
  }
```

The send returned a `task` already in `TASK_STATE_COMPLETED`, and `GetTask` returned the same task with its `history` (capture/out/23-a2a.http). The answer `pong` sits in the second artifact, and `history` keeps only the user message. The server made one live call to `ai/qwen3:4b`, because `serve a2a` has no `--fake`. The card sets `streaming: true`, so `SendStreamingMessage` is on offer, but the capture did not call it. [Figure](#fig-6-3) draws the exchange.

Sessions persist in the session database since v1.59.0, and a client resumes one through `/invoke` with its A2A context {{rel-agent v1.59.0}}. A context id that collides with another session is rejected, and that session stays unchanged {{docs-agent A2A Protocol}}. Sessions that older binaries stored are labelled `run` and cannot be resumed over A2A {{docs-agent A2A Protocol}}.

```figure
id: fig-6-3
kind: sequence
title: one A2A card, one SendMessage, one GetTask
claim: The client reads the card, sends one blocking SendMessage that makes one model call, and gets back a completed task that GetTask returns again.
caption: Read top to bottom. Solid ink arrows are requests and dashed ink arrows are replies. The plum arrow is the live model call, and the amber box is the task state the reply carries. From capture/out/23-a2a.http.
```

## Where it differs from A2A 1.0.1

The A2A 101 manual of this repository states the 1.0.1 rules: [AgentCard fields](manuals/a2a-101/sections/2-1-agentcard-fields.md) for the card and [SendMessage](manuals/a2a-101/sections/4-1-send-message.md) for the call. The table holds each captured value against those rules.

| What `serve a2a` returned | A2A 1.0.1, as A2A 101 states it | Result |
|---|---|---|
| the card at `/.well-known/agent-card.json` | the well-known path of spec §8.2 | match |
| one interface: `/invoke`, `JSONRPC`, `protocolVersion: "1.0"` | `url`, `protocolBinding`, and `protocolVersion` are REQUIRED, and the version is `Major.Minor` | match |
| `SendMessage`, `GetTask`, `ROLE_USER`, `TASK_STATE_COMPLETED` | PascalCase method names and the 1.0 enum names | match |
| a send with no `configuration` returned a terminal task | a send blocks until a terminal or interrupted state | match |
| `skills[0].name` is an empty string | each skill needs an `id`, a `name`, a `description`, and one tag | differs: no skill name |
| `defaultInputModes` and `defaultOutputModes` are empty lists | a REQUIRED list holds at least one element | differs: two empty lists |
| `version` is `v1.149.0` | `version` is the agent's own release | differs: the docker-agent release |
| task `metadata` keyed by `https://google.github.io/adk-docs/a2a/a2a-extension/` | an extension is declared in `capabilities.extensions`, and its data is keyed by its URI | differs: the card declares no extension |
| an artifact whose one part is an empty `data` object, marked `adk_partial` | an artifact needs a unique `artifactId` and at least one part | allowed, but empty |

The `adk_*` keys come from the A2A library the server is built on, which v1.129.0 moved to `adka2a/v2` {{rel-agent v1.129.0}}. The docs list four limitations, among them "A2A artifact support not yet integrated" {{docs-agent A2A Protocol}} ([conflict C70](#s-ref-sources-and-the-conflicts-register)). The capture contradicts that one, because the answer arrives as an artifact. The other three cover tool events, memory, and sub-agents, and the pong agent has none of them, so the capture cannot test them.

## The a2a toolset is the client side

An agent file calls a remote A2A agent with a `type: a2a` toolset. It takes a `url`, an optional `name`, and `headers`, such as a bearer token for `--auth-token` {{docs-agent A2A Tool}}. The schema adds `allow_private_ips`, to "Opt in to dialling non-public IP addresses (valid for type 'fetch', 'api', 'openapi', 'a2a', and remote MCP toolsets)" {{schema allow_private_ips}}. Without it, the client refuses loopback on the direct path, so a call to `127.0.0.1:8082` needs `allow_private_ips: true`. The capture did not run that toolset. For the protocol itself, read [the A2A lesson](phases/13-tools-and-protocols/19-a2a-protocol).

```takeaways
- Fetch the card from `/.well-known/agent-card.json`, then post to its `supportedInterfaces` URL.
- Read the answer from the task's artifacts, never from `history`.
- Accept an empty skill name and empty mode lists in a client that calls `serve a2a`.
- Set `allow_private_ips: true` on an `a2a` toolset that calls a loopback server.
```

Sources: help-agent docker-agent serve a2a (research/sources/help-docker-agent.md); docs-agent A2A Protocol, A2A Tool (research/sources/docs-docker-agent.md); schema allow_private_ips (research/sources/agent-schema.json); rel-agent v1.59.0, v1.129.0 (research/sources/docker-agent-CHANGELOG.md); research/conflicts-register.md rows C64, C70, C71; research/plan.md, Part 6; manuals/a2a-101/sections/2-1-agentcard-fields.md, 4-1-send-message.md, 2-2-discovery-and-supported-interfaces.md, 3-3-artifact-and-chunks.md, 5-1-json-rpc.md, 6-2-extensions.md; capture/README.md; capture/fixtures/agents/pong.yaml; capture/out/23-agent-card.json, 23-a2a.http
