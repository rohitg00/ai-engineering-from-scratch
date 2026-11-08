---
id: a2a-and-agent-messaging
title: A2A and Agent Communication Protocols
code: A2
subtitle: MCP, A2A, ACP, ANP and FIPA-ACL side by side. Agent Cards, tasks, wire names and failures. A2A 1.0.1.
hue: 165
sources: phases/13-tools-and-protocols/19-a2a-protocol, phases/16-multi-agent-and-swarms/02-fipa-acl-heritage, phases/16-multi-agent-and-swarms/03-communication-protocols, phases/16-multi-agent-and-swarms/12-a2a-protocol
source_hash: 67d717f0e4fbfde7
---

## Four protocols side by side
type: comparison
span: 2
from: phases/16-multi-agent-and-swarms/03-communication-protocols/docs/en.md

| Factor | MCP | A2A | ACP | ANP |
|---|---|---|---|---|
| Primary use | Agent to Tool | Agent to Agent | Agent to Agent | Agent to Agent |
| Spec format | JSON-RPC | JSON-RPC / REST / gRPC | OpenAPI 3.1 (REST) | JSON-RPC |
| Discovery | Tool listing | `/.well-known/agent-card.json` | `GET /agents`, `/.well-known/agent.yml` | `/.well-known/agent-descriptions` |
| Identity | Implicit (local) | Security schemes (OAuth, mTLS) | Server-level | W3C DID (`did:wba`) with E2EE |
| Audit trail | N/A | Basic (task history) | TrajectoryMetadata | Not formally specified |
| Streaming | N/A | SSE | SSE | Transport-agnostic |
| Unique feature | Tool schemas | Agent Cards + Skills | Trajectory audit trail | Meta-protocol negotiation |
| Status | Stable | Stable (v1.0) | Merging into A2A | Active development |

## Use X when
type: concepts
from: phases/16-multi-agent-and-swarms/03-communication-protocols/docs/en.md, phases/13-tools-and-protocols/19-a2a-protocol/docs/en.md, phases/16-multi-agent-and-swarms/12-a2a-protocol/docs/en.md

- **MCP**: you want to invoke a specific tool. Agent to tool.
- **A2A**: you want to delegate a whole task to another agent.
- **A2A + ACP patterns**: you need audit trails for compliance.
- **ANP + A2A**: agents are outside your org and share no infrastructure.
- **A2A + message broker**: external agents on shared infrastructure.
- **Direct RPC**: latency-sensitive micro-calls. A2A's lifecycle is async.
- **No protocol**: agents do not need to talk to each other.

## A2A call over HTTP+JSON
type: architecture
from: phases/16-multi-agent-and-swarms/12-a2a-protocol/docs/en.md, phases/16-multi-agent-and-swarms/12-a2a-protocol/code/main.py

```arch
node | client | 1,1 | Client agent | sends A2A-Version: 1.0 | client
node | card | 2,1 | Agent Card | /.well-known/agent-card.json | store
node | send | 1,2 | POST /message:send | returnImmediately | process
node | store | 2,2 | TaskStore | state + artifacts | store
node | poll | 3,2 | GET /tasks/{id} | until a terminal state | process
edge | client | card | discover
edge | client | send | message
edge | send | store | create task
edge | store | poll | task
```

## Task lifecycle with a pause
type: flow
from: phases/13-tools-and-protocols/19-a2a-protocol/docs/en.md, phases/13-tools-and-protocols/19-a2a-protocol/code/main.py, phases/16-multi-agent-and-swarms/03-communication-protocols/docs/en.md

1. **Client**: sends `SendMessage` with no `taskId`. The server creates the Task.
2. **Server**: sets `TASK_STATE_SUBMITTED`, then `TASK_STATE_WORKING`.
3. **Server**: data is missing. It sets `TASK_STATE_INPUT_REQUIRED` with a `ROLE_AGENT` message.
4. **Client**: sends a new message with the same `taskId` and a `data` part.
5. **Server**: goes back to `TASK_STATE_WORKING` and adds an Artifact.
6. **Server**: sets `TASK_STATE_COMPLETED`. Terminal states are immutable.
7. **Client**: a follow-up creates a new task within the same `contextId`.

## A2A tasks on the wire
type: task-table
span: 2
from: phases/13-tools-and-protocols/19-a2a-protocol/docs/en.md, phases/16-multi-agent-and-swarms/12-a2a-protocol/docs/en.md, phases/16-multi-agent-and-swarms/12-a2a-protocol/code/main.py

| Task | Code |
|---|---|
| Discover an agent | `GET /.well-known/agent-card.json` |
| Send and wait (JSON-RPC) | `"method": "SendMessage"` |
| Send, return at once (HTTP+JSON) | `POST /message:send` with `configuration.returnImmediately` |
| Poll a task | `GetTask` or `GET /tasks/{id}` |
| Stream a task over SSE | `SendStreamingMessage` or `POST /message:stream` |
| Reattach to a running task | `SubscribeToTask` or `/tasks/{id}:subscribe` |
| Cancel or list tasks | `CancelTask`, `ListTasks` |
| Run the demo server and client | `python3 code/main.py` |

## Agent Card and Message shape
type: annotated-code
lang: json
from: phases/13-tools-and-protocols/19-a2a-protocol/docs/en.md

```json
{"name": "research-agent", "version": "1.2.0",
 "supportedInterfaces": [{"url": "<url>",           // pick the first binding you speak
   "protocolBinding": "JSONRPC", "protocolVersion": "1.0"}],
 "capabilities": {"streaming": true, "pushNotifications": true},
 "securitySchemes": {"bearer": {"httpAuthSecurityScheme": {"scheme": "Bearer"}}},
 "securityRequirements": [{"schemes": {"bearer": {"list": []}}}],
 "defaultInputModes": ["text/plain"],               // media types
 "skills": [{"id": "summarize_paper", "tags": ["research"]}]}
{"messageId": "msg-001", "role": "ROLE_USER",       // or ROLE_AGENT
 "parts": [{"text": "Summarize this paper."},       // one content field per Part
   {"raw": "...", "filename": "paper.pdf", "mediaType": "application/pdf"},
   {"data": {"targetLength": "3 paragraphs"}}]}     // no kind field
```

## Defaults and numbers
type: defaults
from: phases/13-tools-and-protocols/19-a2a-protocol/docs/en.md, phases/16-multi-agent-and-swarms/12-a2a-protocol/docs/en.md, phases/16-multi-agent-and-swarms/12-a2a-protocol/code/main.py, phases/16-multi-agent-and-swarms/03-communication-protocols/docs/en.md

| Setting | Default | Note |
|---|---|---|
| `A2A_VERSION` | "1.0" | Send `A2A-Version: 1.0` on every request |
| No `A2A-Version` header | 0.3 | The server reads the request as version 0.3 |
| `returnImmediately` | False | `SendMessage` blocks until terminal or interrupted |
| `A2A_MEDIA_TYPE` | "application/a2a+json" | Content type of the HTTP+JSON binding |
| `PORT` | 8765 | Lesson 16.12 demo server |
| ANP negotiation | max 10 rounds | Then timeout |

## FIPA-ACL heritage
type: comparison
from: phases/16-multi-agent-and-swarms/02-fipa-acl-heritage/docs/en.md

| Modern spec | FIPA analog | Keeps | Drops |
|---|---|---|---|
| MCP `tools/call` | `request` | intent, correlation id | semantics, ontology |
| MCP `resources/read` | `query-ref` | intent, correlation id | formal semantics |
| A2A Task lifecycle | contract-net + request-when | async lifecycle | completeness guarantees |
| A2A streaming events | subscribe/notify | async push | typed-predicate subscription |
| NLIP | natural-language content | LLM-native | schema |

## Troubleshooting
type: troubleshooting
from: phases/13-tools-and-protocols/19-a2a-protocol/code/main.py, phases/16-multi-agent-and-swarms/12-a2a-protocol/code/main.py, phases/16-multi-agent-and-swarms/03-communication-protocols/docs/en.md, phases/16-multi-agent-and-swarms/02-fipa-acl-heritage/docs/en.md, phases/16-multi-agent-and-swarms/12-a2a-protocol/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| JSON-RPC error `-32009` | Missing or wrong `A2A-Version` | Send `A2A-Version: 1.0` |
| JSON-RPC error `-32601` | Unknown method name | Use PascalCase names such as `SendMessage` |
| HTTP 400 `VERSION_NOT_SUPPORTED` | HTTP+JSON call without the header | Add the header to every request |
| HTTP 404 `TASK_NOT_FOUND` | Unknown task id on `GET /tasks/{id}` | Use the id from the `task` reply |
| Updates after completion lost | Task is immutable once terminal | Check terminal state before you yield |
| Garbage after a card update | Schema drift between versions | Version skills and output schemas |
| Same word, wrong action | Semantic drift without ontology | JSON Schema on `content`, typed artifacts |
| 50 agents hit `GET /agents` | Discovery thundering herd | Cache Agent Cards with TTL |

## Abbreviations
type: glossary
from: phases/16-multi-agent-and-swarms/03-communication-protocols/docs/en.md, phases/16-multi-agent-and-swarms/02-fipa-acl-heritage/docs/en.md, phases/16-multi-agent-and-swarms/12-a2a-protocol/docs/en.md

- **A2A**: Agent2Agent. Peer protocol with Agent Cards and tasks.
- **ACP**: Agent Communication Protocol. REST runs with TrajectoryMetadata.
- **ANP**: Agent Network Protocol. `did:wba` identity and HPKE E2EE.
- **DID**: Decentralized Identifier. W3C identity on the agent's own domain.
- **NLIP**: Ecma Natural Language Interaction Protocol. Natural-language content type.
- **FIPA**: Foundation for Intelligent Physical Agents. Standardized ACL in 2000.
- **ACL**: Agent Communication Language. Performative plus content plus metadata.
- **KQML**: Knowledge Query and Manipulation Language (1993). FIPA's predecessor.

## Questions
type: qa
from: phases/13-tools-and-protocols/19-a2a-protocol/docs/en.md, phases/16-multi-agent-and-swarms/12-a2a-protocol/docs/en.md, phases/16-multi-agent-and-swarms/03-communication-protocols/docs/en.md, phases/16-multi-agent-and-swarms/02-fipa-acl-heritage/docs/en.md

- **What does the caller see in A2A?** Task state and artifacts. The called agent's internals stay opaque.
- **How do I stop duplicate tasks on retry?** Deduplicate on the client's `messageId`.
- **How is an Agent Card signed?** A JWS in `signatures` over the RFC 8785 canonical JSON, without `signatures`.
- **What does ACP add?** Each part can carry `tool_name`, `tool_input` and `tool_output` metadata.
- **DID fetch fails. Open or closed?** Fail closed with the principle of least trust.
- **Which FIPA protocols are worth porting?** Contract Net, Subscribe/Notify and Request-When.
