---
id: compact-or-hand-off
title: Compact the context, or end the session and hand off
card: agents
kind: tradeoff
level: 3
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [design-review, system-design]
tags: [compaction, handoff, context-budget, fresh-session, long-running]
minutes: 10
lessons: [phases/14-agent-engineering/40-multi-session-handoff]
manuals: []
practice: []
cheatsheet: [agent-workbench-ops, coding-agents]
related: [agents/a-handoff-is-not-a-status-report]
updated: 2026-11-03
---

A long coding session has used most of its context window. The runtime offers to summarize the older turns and keep going. Your teammate wants to let it run to the limit, because compaction is automatic. When do you compact, when do you end the session, and what do you measure to choose?

## Short answer

Compaction extends a session, and a handoff closes one cleanly and starts the next in fresh context. Compaction is fine while the compressed history still carries what the task needs, but quality decays as compression stacks up. The lesson's guidance is to end the session with a generated handoff at 50 to 75 percent of the budget, not at the wall, because the packet is cheap to write while the context is intact and expensive when the model is already losing its place.

## Full answer

### Two different operations

| Operation | What it does | What it costs |
|---|---|---|
| Compaction | Compresses the history in place and continues the same session | Each pass loses detail, and the losses stack up |
| Fresh-session handoff | Writes a packet, ends the session, and resumes in a new context | A clean break, with the cost of generating and loading the packet |

Runtimes implement compaction in different ways: a server-side opaque summary, a local summary appended as a user message, a progressive multi-stage compression near the top of the window, or a timestamp-based hiding of old messages plus a short summary. The mechanism varies. The need is the same. Whatever survives compression must be serialized into a portable artifact, and that artifact is the handoff packet.

### Why not run to the wall

A runtime that compacts at 95 percent compacts a context that is already full of compression artifacts. The packet generator then summarizes degraded state. The mistake is to keep compressing until quality collapses. The fix is to budget for an early, clean handoff. A session that ends at 50 to 75 percent still has the intact history, the real command records and a clear next action.

### Make the choice measurable

- Track the context fraction at which the session ends, and compare task outcomes across the two ranges.
- Count how many times a session was compacted before it ended, and correlate with review findings.
- Read the handoff packets: a packet with a vague `next_action` is a sign that the generator ran too late.

### One active handoff per branch

Multi-agent work breaks on stale handoffs more than on bad output. Each packet carries the branch, the last known good commit and a status of active, superseded or archived. Only the active packet drives the next session.

## Follow-ups

- **Level 3:** Why is a fresh session better than a third compaction? Expected: compression losses stack up, while a fresh session starts from the packet, the state file and the repo, which are the system of record.
- **Level 3:** What must be true of the tree before the handoff runs? Expected: the cleanup check passes, so the tree is committed or stashed with a note, no temp files remain, tests are green or named as risks, and the branch is right.
- **Level 4:** The handoff is cheap, but the next session has to rebuild its working context. How do you keep that cost down? Expected: the packet lists the exact artifacts the next session must load before it acts, and the router points at them, so the session loads the state, the board and the active contract and nothing else.
- **Level 4:** Two coding agent products are used on one task, one after the other. What makes the transition work? Expected: the packet schema, because the JSON form is product-neutral and both runtimes read the same fields.

## Wrong answers

- "Compaction is automatic, so let the runtime handle it." Automatic compaction decides when to compress, not whether the compressed state is still good enough to work from.
- "End every session as early as possible to be safe." Each handoff costs a packet and a reload, so the target is a range, not a minimum.
- "A longer context window removes the problem." A larger window delays the wall, and the quality decay from stacked compression is the same.

## Taught in

The [multi-session handoff lesson](../../../phases/14-agent-engineering/40-multi-session-handoff/) compares compaction strategies and sets the handoff window.
