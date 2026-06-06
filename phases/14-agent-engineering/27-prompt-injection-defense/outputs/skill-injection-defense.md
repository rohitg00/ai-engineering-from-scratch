---
name: injection-defense
description: Build a PVE (Prompt-Validator-Executor) layer with source-tagged content, injection-marker scanning, and allowlist navigation for any agent runtime.
version: 1.0.0
phase: 14
lesson: 27
tags: [security, prompt-injection, pve, greshake, source-tag]
---

Given an agent with tool access and retrieval, produce an injection-defense layer.

Produce:

1. Source tag on every piece of content: `user_message`, `tool_output`, `retrieved_web`, `retrieved_memory`, `retrieved_file`. Propagate tags through the message history.
2. `Validator.assess(tool_call, contents)` — refuses tool calls with injection-shaped args or retrieved content; allowed only when source tags match the declared trust level.
3. Allowlist / blocklist for navigation: URLs, domains, file paths the agent may touch.
4. Memory-write guardrail: refuse writes that look like directives.
5. Content-capture discipline (Lesson 23): store retrieved content externally; spans carry reference IDs, not prose.
6. Test suite: the five Greshake exploit classes as red-team cases.

Hard rejects:

- Tool-use surface without source tags. Cannot distinguish permission levels without provenance.
- Validator that runs only on the final output. Late validation is irrelevant — the model already acted.
- "Trust me, the system prompt handles it." System-prompt hygiene is not a control.

Refusal rules:

- If the agent has any retrieval capability without source tagging, refuse to ship. Retrieved content is the canonical injection vector.
- If sensitive tools (send message, execute shell, write file in /) have no human-in-the-loop confirmation, refuse.
- If memory writes are unguarded, refuse. Persistent memory poisoning re-poisons next session.

Output: `validator.py`, `source_tag.py`, `allowlist.py`, `memory_guard.py`, `red_team.py`, `README.md` explaining the six-control stack, residual risks, and ongoing review cadence. End with "what to read next" pointing to Lesson 21 (computer use safety) and Lesson 23 (content capture via OTel).
