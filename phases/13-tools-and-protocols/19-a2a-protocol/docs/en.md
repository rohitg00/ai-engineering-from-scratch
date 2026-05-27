# A2A — Agent-to-Agent Protocol

> MCP is agent-to-tool. A2A (Agent2Agent) is agent-to-agent — an open protocol for letting opaque agents built on different frameworks collaborate. Released by Google in April 2025, donated to the Linux Foundation in June 2025, reaching v1.0 in April 2026 with 150+ supporters including AWS, Cisco, Microsoft, Salesforce, SAP, and ServiceNow. It absorbed IBM's ACP and added the AP2 payments extension. This lesson walks the Agent Card, Task lifecycle, and the two transport bindings.

**Type:** Build
**Languages:** Python (stdlib, Agent Card + Task harness)
**Prerequisites:** Phase 13 · 06 (MCP fundamentals), Phase 13 · 08 (MCP client)
**Time:** ~75 minutes

## Learning Objectives

- Distinguish agent-to-tool (MCP) from agent-to-agent (A2A) use cases.
- Publish an Agent Card at `/.well-known/agent.json` with skills and endpoint metadata.
- Walk the Task lifecycle (submitted → working → input-required → completed / failed / canceled / rejected).
- Use Messages with Parts (text, file, data) and Artifacts as outputs.

## The Problem

A customer-service agent needs to delegate report-writing to a specialized writer agent. Options pre-A2A:

- Custom REST API. Works but every pairing is a one-off.
- Shared codebase. Requires the two agents to run the same framework.
- MCP. Doesn't fit: MCP is for calling tools, not for two agents collaborating while preserving each agent's opaque internal reasoning.

A2A fills the gap. It models the interaction as one agent sending a Task to another, with a lifecycle, messages, and artifacts. The called agent's internal state stays opaque — the caller sees only task state transitions and eventual outputs.

A2A is the "let agents across frameworks talk to each other" protocol. It does not replace MCP; the two are complementary.

## The Concept

### Agent Card

Every A2A-compliant agent publishes a card at `/.well-known/agent.json`:

```json
{
  "schemaVersion": "1.0",
  "name": "research-agent",
  "description": "Summarizes academic papers and drafts citations.",
  "url": "https://research.example.com/a2a",
  "version": "1.2.0",
  "skills": [
    {
      "id": "summarize_paper",
      "name": "Summarize a paper",
      "description": "Read a paper PDF and produce a 3-paragraph summary.",
      "inputModes": ["text", "file"],
      "outputModes": ["text", "artifact"]
    }
  ],
  "capabilities": {"streaming": true, "pushNotifications": true}
}
```

Discovery is URL-based: fetch the card, learn the URL of the A2A endpoint, enumerate skills.

### Signed Agent Cards (AP2)

The AP2 extension (September 2025) adds cryptographic signatures to Agent Cards. A publisher signs its own card with a JWT; consumers verify. Prevents impersonation.

### Task lifecycle

```
submitted -> working -> completed | failed | canceled | rejected
             -> input_required -> working (loop via message)
```

Clients initiate with `tasks/send`. The called agent transitions through states; clients subscribe to state updates via SSE or poll.

### Messages and Parts

A message carries one or more Parts:

- `text` — plain content.
- `file` — base64 blob with mimeType.
- `data` — typed JSON payload (structured input for the called agent).

Example:

```json
{
  "role": "user",
  "parts": [
    {"type": "text", "text": "Summarize this paper."},
    {"type": "file", "file": {"name": "paper.pdf", "mimeType": "application/pdf", "bytes": "..."}},
    {"type": "data", "data": {"targetLength": "3 paragraphs"}}
  ]
}
```

### Artifacts

Outputs are Artifacts, not raw strings. An Artifact is a named, typed output:

```json
{
  "name": "summary",
  "parts": [{"type": "text", "text": "..."}],
  "mimeType": "text/markdown"
}
```

Artifacts can be streamed as chunks. The caller accumulates.

### Two transport bindings

1. **JSON-RPC over HTTP.** `/a2a` endpoint, POST for requests, optional SSE for streaming. Default binding.
2. **gRPC.** For enterprise environments where gRPC is native.

Both bindings carry the same logical message shape.

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
| Authorization | OAuth 2.1 (Phase 13 · 16) | JWT-signed Agent Cards (AP2) |
| Transport | Stdio / Streamable HTTP | JSON-RPC over HTTP / gRPC |

Use MCP when you want to invoke a specific tool. Use A2A when you want to delegate a whole task to another agent. Many production systems use both: an agent uses MCP for its tool layer and A2A for its collaboration layer.

## Use It

`code/main.py` implements a minimal A2A harness: a research agent publishes its card, a writer agent receives a `tasks/send` with parts including a PDF and a text instruction, transitions through working → input_required → working → completed, and returns a text artifact. All stdlib; uses an in-memory transport to focus on message shapes.

What to look at:

- Agent Card JSON shape.
- Task id assignment and state transitions.
- Messages with mixed-type parts.
- Input-required branch mid-task.
- Artifact return on completion.

## Ship It

This lesson produces `outputs/skill-a2a-agent-spec.md`. Given a new agent that should be callable by other agents, the skill produces the Agent Card JSON, skills schema, and endpoint blueprint.

## Exercises

1. Run `code/main.py`. Trace the full Task lifecycle, including the input-required pause where the called agent asks for a clarification.

2. Add a signed Agent Card. Sign with HMAC over the card's canonical JSON. Write a verifier and confirm it fails on a mutated card.

3. Implement task streaming: the writer agent emits three incremental artifact chunks over SSE and the caller accumulates them.

4. Design an A2A agent that wraps an MCP server. Map each MCP tool to an A2A skill. Note the trade-offs — what opacity is lost?

5. Read the A2A v1.0 announcement and identify the one feature that is not yet implemented by any framework as of April 2026. (Hint: it relates to multi-hop task delegation.)

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| A2A | "Agent-to-Agent protocol" | Open protocol for opaque agent collaboration |
| Agent Card | "`.well-known/agent.json`" | Published metadata describing an agent's skills and endpoint |
| Skill | "A callable unit" | A named operation the agent supports (analog to MCP tool) |
| Task | "Unit of delegation" | A work item with a lifecycle and final artifact |
| Message | "Task input" | Carries Parts (text, file, data) |
| Part | "Typed chunk" | `text` / `file` / `data` element of a message |
| Artifact | "Task output" | Named, typed output returned on completion |
| AP2 | "Agent Payments Protocol" | Signed Agent Cards extension for trust and payments |
| Opacity | "Black-box collaboration" | Called agent's internals are hidden from caller |
| Input-required | "Task pause" | Lifecycle state when the agent needs more info |

## Further Reading

- [a2a-protocol.org](https://a2a-protocol.org/latest/) — canonical A2A specification
- [a2aproject/A2A — GitHub](https://github.com/a2aproject/A2A) — reference implementations and SDKs
- [Linux Foundation — A2A launch press release](https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents) — June 2025 governance transfer
- [Google Cloud — A2A protocol upgrade](https://cloud.google.com/blog/products/ai-machine-learning/agent2agent-protocol-is-getting-an-upgrade) — roadmap and partner momentum
- [Google Dev — A2A 1.0 milestone](https://discuss.google.dev/t/the-a2a-1-0-milestone-ensuring-and-testing-backward-compatibility/352258) — v1.0 release notes and backward-compat guidance
