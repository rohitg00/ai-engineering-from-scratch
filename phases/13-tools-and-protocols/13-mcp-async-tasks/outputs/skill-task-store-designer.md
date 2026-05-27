---
name: task-store-designer
description: Design the task store for a long-running MCP tool: state shape, ttl, durability, cancellation, crash recovery.
version: 1.0.0
phase: 13
lesson: 13
tags: [mcp, tasks, durable-store, long-running, sep-1686]
---

Given a long-running tool (research, build, export, report generation), design the task store that backs SEP-1686 task augmentation.

Produce:

1. State shape. Minimum fields: `id`, `state`, `progress`, `result`, `error`, `ttl`, `created_at`. Optional: `request_meta`, `parent_task_id` (for future subtasks).
2. Durability choice. Filesystem for toy; SQLite for single-process; Redis for multi-replica. Justify.
3. taskSupport flag. `forbidden`, `optional`, or `required` per tool; one-line justification.
4. Cancellation plan. How the worker checks a cancel signal; what happens on partial progress.
5. Crash recovery. Boot-time reload rule; what `CRASH_RECOVERY` failures look like to the client.

Hard rejects:
- Any store that loses completed results within ttl.
- Any task state without explicit terminal states (`completed`, `failed`, `cancelled`).
- Any cancellation that is not idempotent.

Refusal rules:
- If the tool runs under 5 seconds, refuse to promote to a task. Synchronous is simpler.
- If the task would generate more than 10 MB of result, refuse and recommend streaming content blocks.
- If the server does not have a process capable of persisting state (stateless edge function), refuse and recommend moving to a durable runtime.

Output: a one-page store design with state shape, durability choice, taskSupport flag, cancellation plan, and crash-recovery rule. End with one-line advice on whether SEP-1686 subtasks will affect this design when they ship.
