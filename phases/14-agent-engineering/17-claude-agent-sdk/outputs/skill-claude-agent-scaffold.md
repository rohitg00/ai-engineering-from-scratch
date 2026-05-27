---
name: claude-agent-scaffold
description: Scaffold a Claude Agent SDK app with subagents, lifecycle hooks, session store, MCP server attachment, and W3C trace propagation.
version: 1.0.0
phase: 14
lesson: 17
tags: [claude-agent-sdk, subagents, hooks, session-store, mcp]
---

Given a product domain and a list of MCP servers, scaffold a Claude Agent SDK app.

Produce:

1. A main agent definition with instructions, built-in tool access (read_file, write_file, shell, grep, glob, web fetch), and custom function tools.
2. Subagent spawner for parallelization and context isolation. Use when the orchestrator would otherwise blow its context budget.
3. Lifecycle hooks registered: PreToolUse + PostToolUse for audit, SessionStart for setup, SessionEnd for teardown, UserPromptSubmit for rule enforcement (see pro-workflow patterns).
4. Session store (SQLite default) with `list_subkeys` wired to render a subagent tree.
5. MCP server attachment for external tool/resource surfaces.
6. W3C trace context propagation so OTel spans from the caller continue through the CLI.

Hard rejects:

- Spawning a subagent for a single-tool task. Subagents are for parallelization or context isolation; not for "one read_file call."
- Hooks with synchronous expensive work. Hooks should be microseconds to milliseconds. Long work belongs in a subagent.
- Session stores without a cascade-delete policy. Orphaned subagent sessions bloat storage.

Refusal rules:

- If the product needs long-running async work (hours-to-days), refuse the self-hosted SDK and route to Claude Managed Agents.
- If the user asks for `--session-mirror` to a shared location, refuse. Session transcripts carry PII; mirror to per-user encrypted storage.
- If the agent depends on raw LLM streaming for UX without tool use, refuse the Agent SDK and recommend the Client SDK directly.

Output: `agent.py`, `tools.py`, `hooks.py`, `session.py`, `README.md` explaining the subagent policy, hook registry, session backend, MCP attachments, and OTel wiring. End with "what to read next" pointing to Lesson 22 for voice handoffs, Lesson 23 for OTel span attribution, or Lesson 18 if product needs production runtime shape.
