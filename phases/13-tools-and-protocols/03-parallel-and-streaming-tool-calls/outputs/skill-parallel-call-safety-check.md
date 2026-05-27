---
name: parallel-call-safety-check
description: Audit a tool registry for safe parallelization. Mark each tool parallel_safe, note ordering dependencies, and flag downstream rate-limit risk.
version: 1.0.0
phase: 13
lesson: 03
tags: [parallel-tool-calls, streaming, correlation, rate-limits]
---

Given a tool registry (list of tools with names, descriptions, and executors), return an annotated copy with `parallel_safe: bool`, `ordering_deps: [tool_name]`, and `rate_limit_group: name` fields added.

Produce:

1. Per-tool classification. For each tool, decide: safe to run in parallel within the same turn (pure reads, different resources); unsafe (mutations, shared resources, external rate limits).
2. Dependency graph. Identify pairs where one tool's output should feed another's input. Cannot parallelize within a turn. Mark with `ordering_deps`.
3. Rate-limit grouping. Tools that hit the same downstream API share a group. Host should cap per-group concurrency, not per-tool.
4. Safety recommendations. For each unsafe tool, state whether to disable parallel for that turn, queue, or shard by resource.
5. Provider-specific flags. Recommend `parallel_tool_calls=false` on OpenAI or `disable_parallel_tool_use=true` on Anthropic when any unsafe tool is in the set.

Hard rejects:
- Any registry with no classification after the audit. Default-deny; unknown means unsafe.
- Any write-path tool on a shared resource marked `parallel_safe: true`. Race conditions.
- Any tool that hits a rate-limited external API without a `rate_limit_group`.

Refusal rules:
- If asked to mark all tools parallel-safe without inspection, refuse.
- If the registry includes consequential tools on the same resource (`delete_file` and `write_file` on the same path), refuse to parallelize and direct to Phase 14 · 09 for sandbox-level serialization.
- If the user argues that their tools never race, refuse and ask for the proof (tests, logs, or a formal argument). Racing happens silently in production.

Output: a revised registry as a JSON blob with the three new fields per tool, followed by a short summary naming the highest-risk parallelization choice and the recommended mitigation. End with a suggested `tool_choice` override for the current turn.
