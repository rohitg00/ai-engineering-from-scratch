# Capstone — Build a Complete Tool Ecosystem

> Phase 13 taught every piece. This capstone wires them into one production-shaped system: an MCP server with tools + resources + prompts + tasks + UI, OAuth 2.1 at the edge, an RBAC gateway, a multi-server client, an A2A sub-agent call, OTel tracing into a collector, tool-poisoning detection in CI, and an AGENTS.md + SKILL.md bundle. By the end you can defend every architectural choice.

**Type:** Build
**Languages:** Python (stdlib, end-to-end ecosystem harness)
**Prerequisites:** Phase 13 · 01 through 21
**Time:** ~120 minutes

## Learning Objectives

- Compose an MCP server exposing tools, resources, prompts, and a task with a `ui://` app.
- Front the server with an OAuth 2.1 gateway that enforces RBAC and pinned hashes.
- Write a multi-server client that traces with OTel GenAI attributes end-to-end.
- Delegate part of a workload to an A2A sub-agent; verify opacity is preserved.
- Package the whole stack with AGENTS.md + SKILL.md so other agents can drive it.

## The Problem

Ship the "research and report" system:

- User asks: "summarize the three most-cited 2026 arXiv papers on agent protocols."
- System: search arXiv via MCP; delegate paper summarization to a specialized writer agent via A2A; aggregate results; render an interactive report as an MCP Apps `ui://` resource; log every step to OTel.

All the primitives from Phase 13 show up. This is not a toy — production research-assistant systems shipped in 2026 by Anthropic (the Claude Research product), OpenAI (GPTs with Apps SDK), and third parties have this exact shape.

## The Concept

### Architecture

```
[user] -> [client] -> [gateway (OAuth 2.1 + RBAC)] -> [research MCP server]
                                                      |
                                                      +- MCP tool: arxiv_search (pure)
                                                      +- MCP resource: notes://recent
                                                      +- MCP prompt: /research_topic
                                                      +- MCP task: generate_report (long)
                                                      +- MCP Apps UI: ui://report/current
                                                      +- A2A call: writer-agent (tasks/send)
                                                      |
                                                      +- OTel GenAI spans
```

### Trace hierarchy

```
agent.invoke_agent
 ├── llm.chat (kick off)
 ├── mcp.call -> tools/call arxiv_search
 ├── mcp.call -> resources/read notes://recent
 ├── mcp.call -> prompts/get research_topic
 ├── a2a.tasks/send -> writer-agent
 │    └── task transitions (opaque internals)
 ├── mcp.call -> tools/call generate_report (task-augmented)
 │    └── tasks/status polling
 │    └── tasks/result (completed, returns ui:// resource)
 └── llm.chat (final synthesis)
```

One trace id. Every span has the right `gen_ai.*` attributes.

### Security posture

- OAuth 2.1 + PKCE with resource indicator pinning audience to gateway.
- Gateway holds upstream credentials; user never sees them.
- RBAC: `alice` has `research:read`, `research:write`, can call all tools. `bob` has `research:read`, cannot call `generate_report`.
- Pinned description manifest: dropped any server whose tool hashes changed.
- Rule of Two audit: no tool combines untrusted input, sensitive data, and consequential action.

### Rendering

The final `generate_report` task returns content blocks plus a `ui://report/current` resource. The client's host (Claude Desktop, etc.) renders the interactive dashboard in a sandbox iframe. The dashboard contains a sorted paper list, citation counts, and a button that calls `host.callTool('summarize_paper', {arxiv_id})` for any paper the user clicks.

### Packaging

The whole thing ships as:

```
research-system/
  AGENTS.md                     # project conventions
  skills/
    run-research/
      SKILL.md                  # the top-level workflow
  servers/
    research-mcp/               # the MCP server
      pyproject.toml
      src/
  agents/
    writer/                     # the A2A agent
  gateway/
    config.yaml                 # RBAC + pinned manifest
```

Users deploy with `docker compose up`. Claude Code, Cursor, Codex, and opencode users can drive the system by invoking the `run-research` skill.

### What each Phase 13 lesson contributed

| Lesson | What the capstone uses |
|--------|------------------------|
| 01-05 | Tool interface, provider-portability, parallel calls, schemas, linting |
| 06-10 | MCP primitives, server, client, transports, resources + prompts |
| 11-14 | Sampling, roots + elicitation, async tasks, `ui://` apps |
| 15-17 | Tool poisoning, OAuth 2.1, gateway + registry |
| 18 | A2A sub-agent delegation |
| 19 | OTel GenAI tracing |
| 20 | Routing gateway for the LLM layer |
| 21 | SKILL.md + AGENTS.md packaging |

## Use It

`code/main.py` stitches the previous lessons' patterns into one runnable demo. All stdlib, all in-process so you can read it end to end. It runs the full flow for the research-and-report scenario: handshake with gateway, OAuth 2.1 simulated, tools/list merged, generate_report as a task, A2A call to writer, ui:// resource returned, OTel spans emitted.

What to look at:

- One trace id across every hop.
- Gateway policy blocks a second user from writing.
- Task lifecycle goes working → completed and returns both text and ui:// content.
- A2A call's inner state is opaque to the orchestrator.
- AGENTS.md and SKILL.md are the only files another agent needs to reproduce the workflow.

## Ship It

This lesson produces `outputs/skill-ecosystem-blueprint.md`. Given a product need (research, summarization, automation), the skill produces the full architecture: which MCP primitives, which gateway controls, which A2A calls, which telemetry, which packaging.

## Exercises

1. Run `code/main.py`. Note the single trace id and how spans nest. Count how many primitives from Phase 13 the demo touches.

2. Extend the demo: add a second backend MCP server (e.g. `bibliography`) and confirm the gateway merges its tools into the same namespace.

3. Replace the fake A2A writer agent with a real one running on a subprocess. Use the Lesson 19 harness.

4. Add a PII redaction step in the routing gateway between the orchestrator and the LLM. Confirm emails in the user query get scrubbed.

5. Write an AGENTS.md for a teammate who will maintain this system. It should take under five minutes to read and give them everything they need to drive the capstone in Cursor or Codex.

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Capstone | "Phase-13 integration demo" | End-to-end system using every primitive |
| Research and report | "The scenario" | Search, summarize, render pattern |
| Ecosystem | "All the pieces together" | Server + client + gateway + sub-agent + telemetry + package |
| Trace hierarchy | "Single trace id" | Every hop's span shares the trace; parent-child via span ids |
| Gateway-issued token | "Transitive auth" | Client sees only gateway's token; gateway holds upstream creds |
| Merged namespace | "All tools in one flat list" | Multi-server merge at the gateway, prefix-on-collision |
| Opacity boundary | "A2A call hides internals" | Sub-agent's reasoning invisible to orchestrator |
| Three-layer stack | "AGENTS.md + SKILL.md + MCP" | Project context + workflow + tools |
| Defense-in-depth | "Multiple security layers" | Pinned hashes, OAuth, RBAC, Rule of Two, audit log |
| Spec compliance matrix | "What we ship that the spec requires" | Checklist mapping deliverables to 2025-11-25 requirements |

## Further Reading

- [MCP — Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) — consolidated reference
- [MCP blog — 2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) — where the protocol is heading
- [a2a-protocol.org](https://a2a-protocol.org/latest/) — A2A v1.0 reference
- [OpenTelemetry — GenAI semconv](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — canonical tracing conventions
- [Anthropic — Claude Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview) — production agent runtime patterns
