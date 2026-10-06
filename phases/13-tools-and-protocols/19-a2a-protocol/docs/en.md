# A2A — Agent-to-Agent Protocol

> MCP is agent-to-tool. A2A (Agent2Agent) is agent-to-agent — an open protocol for letting opaque agents built on different frameworks collaborate. Released by Google in April 2025, donated to the Linux Foundation in June 2025, reaching v1.0 in April 2026 with 150+ supporters including AWS, Cisco, Microsoft, Salesforce, SAP, and ServiceNow. It absorbed IBM's ACP and added the AP2 payments extension. This lesson walks the Agent Card, Task lifecycle, and the three protocol bindings, using the A2A 1.0.1 wire names.

**Type:** Build
**Languages:** Python (stdlib, Agent Card + Task harness)
**Prerequisites:** Phase 13 · 06 (MCP fundamentals), Phase 13 · 08 (MCP client)
**Time:** ~75 minutes

## Learning Objectives

- Distinguish agent-to-tool (MCP) from agent-to-agent (A2A) use cases.
- Publish an Agent Card at `/.well-known/agent-card.json` with skills and `supportedInterfaces` metadata.
- Walk the Task lifecycle: `TASK_STATE_SUBMITTED`, `TASK_STATE_WORKING`, `TASK_STATE_INPUT_REQUIRED`, and the terminal states `TASK_STATE_COMPLETED`, `TASK_STATE_FAILED`, `TASK_STATE_CANCELED`, `TASK_STATE_REJECTED`.
- Use Messages whose Parts each hold one of `text`, `raw`, `url`, or `data`, and Artifacts as outputs.

## The Problem

A customer-service agent needs to delegate report-writing to a specialized writer agent. Options pre-A2A:

- Custom REST API. Works but every pairing is a one-off.
- Shared codebase. Requires the two agents to run the same framework.
- MCP. Doesn't fit: MCP is for calling tools, not for two agents collaborating while preserving each agent's opaque internal reasoning.

A2A fills the gap. It models the interaction as one agent sending a Task to another, with a lifecycle, messages, and artifacts. The called agent's internal state stays opaque — the caller sees only task state transitions and eventual outputs.

A2A is the "let agents across frameworks talk to each other" protocol. It does not replace MCP; the two are complementary.

## The Concept

### Agent Card

Every A2A-compliant agent publishes a card at `/.well-known/agent-card.json`:

```json
{
  "name": "research-agent",
  "description": "Summarizes academic papers and drafts citations.",
  "version": "1.2.0",
  "supportedInterfaces": [
    {
      "url": "https://research.example.com/a2a",
      "protocolBinding": "JSONRPC",
      "protocolVersion": "1.0"
    }
  ],
  "capabilities": {"streaming": true, "pushNotifications": true},
  "securitySchemes": {
    "bearer": {"httpAuthSecurityScheme": {"scheme": "Bearer"}}
  },
  "securityRequirements": [{"schemes": {"bearer": {"list": []}}}],
  "defaultInputModes": ["text/plain"],
  "defaultOutputModes": ["text/markdown"],
  "skills": [
    {
      "id": "summarize_paper",
      "name": "Summarize a paper",
      "description": "Read a paper PDF and produce a 3-paragraph summary.",
      "tags": ["research", "summarization"],
      "inputModes": ["text/plain", "application/pdf"],
      "outputModes": ["text/markdown"]
    }
  ]
}
```

Discovery is URL-based: fetch the card, pick the first `supportedInterfaces` entry whose `protocolBinding` your client speaks, and enumerate skills. Input and output modes are media types.

### Signed Agent Cards

A card can carry a `signatures` array. Each entry is a JWS (RFC 7515) computed over the card's RFC 8785 canonical JSON, with the `signatures` field left out. Consumers canonicalize the card the same way and verify. Prevents impersonation.

### Task lifecycle

```text
TASK_STATE_SUBMITTED
  -> TASK_STATE_WORKING
  -> TASK_STATE_COMPLETED | TASK_STATE_FAILED | TASK_STATE_CANCELED | TASK_STATE_REJECTED

TASK_STATE_WORKING
  -> TASK_STATE_INPUT_REQUIRED
  -> TASK_STATE_WORKING (the client sends a message with the same taskId)
```

Clients initiate with `SendMessage`, and the server creates the Task. The called agent transitions through states; clients poll with `GetTask` or stream over SSE with `SendStreamingMessage` and `SubscribeToTask`. A stream carries `statusUpdate` and `artifactUpdate` events and closes when the task reaches a terminal state. There is no `final` flag.

### Messages and Parts

A message has a `messageId`, a `role` (`ROLE_USER` or `ROLE_AGENT`), and one or more Parts. Each Part holds exactly one content field, and that field name is the type. There is no `kind` field.

- `text`: plain content.
- `raw`: file bytes, base64 in JSON, usually with `filename` and `mediaType`.
- `url`: a link to file content.
- `data`: structured JSON payload (structured input for the called agent).

Example:

```json
{
  "messageId": "msg-001",
  "role": "ROLE_USER",
  "parts": [
    {"text": "Summarize this paper."},
    {"raw": "...", "filename": "paper.pdf", "mediaType": "application/pdf"},
    {"data": {"targetLength": "3 paragraphs"}, "mediaType": "application/json"}
  ]
}
```

### Artifacts

Outputs are Artifacts, not raw strings. An Artifact is a named, typed output:

```json
{
  "artifactId": "art-001",
  "name": "summary",
  "parts": [{"text": "...", "mediaType": "text/markdown"}]
}
```

Artifacts can be streamed as chunks. Each `artifactUpdate` event carries the artifact plus `append` and `lastChunk`. The caller accumulates.

### Three protocol bindings

1. **JSON-RPC 2.0 over HTTP** (`JSONRPC`). POST for requests, SSE for streaming. Methods are PascalCase: `SendMessage`, `SendStreamingMessage`, `GetTask`, `ListTasks`, `CancelTask`, `SubscribeToTask`, `CreateTaskPushNotificationConfig`, `GetTaskPushNotificationConfig`, `ListTaskPushNotificationConfigs`, `DeleteTaskPushNotificationConfig`, and `GetExtendedAgentCard`.
2. **gRPC** (`GRPC`). For enterprise environments where gRPC is native. Same method names.
3. **HTTP+JSON/REST** (`HTTP+JSON`). Resource URLs such as `POST /message:send` and `GET /tasks/{id}`.

All three bindings carry the same data model. Each `supportedInterfaces` entry names one binding and its `protocolVersion`. Clients send the header `A2A-Version: 1.0` on every request, because a server reads a request without it as version 0.3.

```http
POST /a2a HTTP/1.1
Host: research.example.com
Content-Type: application/json
A2A-Version: 1.0

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "SendMessage",
  "params": {
    "message": {
      "messageId": "msg-001",
      "role": "ROLE_USER",
      "parts": [{"text": "Summarize this paper."}]
    }
  }
}
```

### Opacity preservation

A key design principle: the called agent's internal state is opaque. The caller sees task state and artifacts. The called agent's chain-of-thought, its tool calls, its sub-agent delegation — all invisible. This is different from MCP, where tool calls are transparent.

Rationale: A2A enables competitors to collaborate without revealing internals. A2A can be "call this customer-service agent" without the caller learning how that agent implements the service.

### Timeline

- **2025-04-09.** Google announces A2A.
- **2025-06-23.** Donated to Linux Foundation.
- **2025-08.** Absorbs IBM's ACP.
- **2025-09.** AP2 extension (Agent Payments) ships.
- **2026-04.** v1.0 released with 150+ supporting organizations.

### Relationship to MCP

| Dimension | MCP | A2A |
|-----------|-----|-----|
| Use case | Agent-to-tool | Agent-to-agent |
| Opacity | Transparent tool calls | Opaque inner reasoning |
| Typical caller | Agent runtime | Another agent |
| State | Tool-call result | Task with lifecycle |
| Authorization | OAuth 2.1 (Phase 13 · 16) | Agent Card `securitySchemes` + `securityRequirements` |
| Transport | Stdio / Streamable HTTP | JSON-RPC / gRPC / HTTP+JSON |

Use MCP when you want to invoke a specific tool. Use A2A when you want to delegate a whole task to another agent. Many production systems use both: an agent uses MCP for its tool layer and A2A for its collaboration layer.

```figure
a2a-task-lifecycle
```

## Use It

`code/main.py` implements a minimal A2A harness: the writer agent publishes its card, the research agent sends it a `SendMessage` request with a PDF part and a text instruction, and the task moves through `TASK_STATE_WORKING` → `TASK_STATE_INPUT_REQUIRED` → `TASK_STATE_WORKING` → `TASK_STATE_COMPLETED` before returning a text artifact. All stdlib; uses an in-memory transport to focus on message shapes.

What to look at:

- Agent Card JSON shape.
- Server-side task id assignment and state transitions.
- Parts typed by which content field is present.
- `TASK_STATE_INPUT_REQUIRED` branch mid-task.
- Artifact return on completion.

## Ship It

This lesson produces `outputs/skill-a2a-agent-spec.md`. Given a new agent that should be callable by other agents, the skill produces the Agent Card JSON, skills schema, and endpoint blueprint.

## Exercises

1. Run `code/main.py`. Trace the full Task lifecycle, including the `TASK_STATE_INPUT_REQUIRED` pause where the called agent asks for a clarification.

2. Add a signed Agent Card. Put one JWS entry in `signatures` with `alg` set to `HS256`, signing the card's canonical JSON without the `signatures` field. Write a verifier and confirm it fails on a mutated card.

3. Implement task streaming with `SendStreamingMessage`: the writer agent emits the `task`, three `artifactUpdate` chunks, and a `statusUpdate` with `TASK_STATE_COMPLETED`, then closes the stream. The caller accumulates the chunks.

4. Design an A2A agent that wraps an MCP server. Map each MCP tool to an A2A skill. Note the trade-offs — what opacity is lost?

5. Read the A2A v1.0 announcement and identify the one feature that is not yet implemented by any framework as of April 2026. (Hint: it relates to multi-hop task delegation.)

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| A2A | "Agent-to-Agent protocol" | Open protocol for opaque agent collaboration |
| Agent Card | "`/.well-known/agent-card.json`" | Published metadata describing an agent's skills and `supportedInterfaces` |
| Skill | "A callable unit" | A named operation the agent supports (analog to MCP tool) |
| Task | "Unit of delegation" | A work item with a lifecycle and final artifact |
| Message | "Task input" | Carries Parts (`text`, `raw`, `url`, `data`) |
| Part | "Typed chunk" | Exactly one of `text` / `raw` / `url` / `data`, plus optional `mediaType`; no `kind` field |
| Artifact | "Task output" | Named, typed output returned on completion |
| AP2 | "Agent Payments Protocol" | Payments extension built on A2A; card signing is core A2A (`signatures`) |
| Opacity | "Black-box collaboration" | Called agent's internals are hidden from caller |
| `TASK_STATE_INPUT_REQUIRED` | "Task pause" | Interrupted state when the agent needs more info |

## Further Reading

- [a2a-protocol.org](https://a2a-protocol.org/latest/) — canonical A2A specification
- [a2aproject/A2A — GitHub](https://github.com/a2aproject/A2A) — reference implementations and SDKs
- [A2A v1.0.1 release](https://github.com/a2aproject/A2A/tree/v1.0.1): the tagged `docs/specification.md` and the normative `specification/a2a.proto` this lesson follows
- [Linux Foundation — A2A launch press release](https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents) — June 2025 governance transfer
- [Google Cloud — A2A protocol upgrade](https://cloud.google.com/blog/products/ai-machine-learning/agent2agent-protocol-is-getting-an-upgrade) — roadmap and partner momentum
- [Google Dev — A2A 1.0 milestone](https://discuss.google.dev/t/the-a2a-1-0-milestone-ensuring-and-testing-backward-compatibility/352258) — v1.0 release notes and backward-compat guidance
