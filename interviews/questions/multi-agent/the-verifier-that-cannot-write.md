---
id: the-verifier-that-cannot-write
title: Design the verifier that has no write handle
card: multi-agent
kind: design
level: 3
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [system-design, design-review]
tags: [verifier, read-only, shared-memory, provenance, verification-channel]
minutes: 12
lessons: [phases/16-multi-agent-and-swarms/13-shared-memory-blackboard]
manuals: []
practice: []
cheatsheet: [multi-agent, agent-failure-modes]
related: [multi-agent/a-number-that-never-existed]
updated: 2026-11-03
---

You are adding a checking agent to a team that shares a memory. A colleague wants the checker to fix wrong entries directly, because that is the simplest design. Specify the checker: what it reads, what it may write, where its results go, and what it can and cannot protect against. Defend the restrictions.

## Short answer

The checker reads the shared memory like every other agent, re-fetches the sources that entries cite, and compares. It has no write handle to the shared memory, only to a separate verification channel that a human or a decision agent reads. It cannot stop a bad entry from being written, and it can be fooled by an entry that cites no source, but its verdicts can never become a shared fact. A checker that writes into the memory is poisoned by the same memory it checks, and then its verdicts carry the poison further.

## Full answer

### The specification

| Aspect | Rule |
|---|---|
| Reads | The whole pool, or the topics it is subscribed to on a blackboard |
| Writes | Nothing in the shared memory, only entries on its own verification channel |
| Method | For each entry with a cited source, fetch the source independently and compare the content |
| Output | A finding per mismatch with the entry id and the reason, routed to a human or a separate decision agent |
| Effect | The verifier writes nothing to the pool. The caller can attach the finding to the entry as a flag, as the lesson's demo does, but the entry's content does not change, and a correction is a new entry that supersedes it |

In the lesson's code the verifier returns a list of findings and never touches the pool. The caller decides what to do with them.

### Why no write handle

Shared memory is the only stateful part of the system, and it is where poisoning happens. A verifier that writes becomes one more writer that can be wrong. Worse, it reads the pool it writes to, so a poisoned pool shapes the verifier's view, and the verifier's conclusions re-enter the pool as new facts with the authority of a check behind them. Separation breaks that cycle. The verifier can be fooled by a bad entry, but its mistakes stay on its channel.

### Why not fix entries in place

An in-place fix destroys the audit trail. The lesson's rule is append-only: a correction is a new entry that references the one it supersedes. With the verifier's finding attached, the record shows that a value was written, that a check disagreed, and what the check found. A reader three steps later can see the dispute. An overwritten entry shows nothing.

### What it protects against, and what it does not

It catches an entry that cites a source and does not match it, which is the poisoning case. It does not catch an entry with no citation, an entry whose source is itself wrong, or a wrong conclusion drawn correctly from flagged inputs. For those you need provenance so that uncited claims are weighed lower, a diversity of sources, and a decision agent that reads the findings.

### How it fits the rest

Provenance on every write gives the verifier something to check. The append-only log gives its findings a place to attach. The verification channel gives its output a reader that is not the pool. The three mitigations are one design.

## Follow-ups

- **Level 3:** The verifier flags an entry that the analyst already used. What happens to the analyst's entry? Expected: it stays in the log, a new entry can supersede it with the finding as the reason, and the final report carries the retraction.
- **Level 3:** How many verifiers do you deploy? Expected: at least one, and more if the pool is partitioned by topic, with each verifier subscribed to the topics it can check.
- **Level 4:** How do you keep the verifier's source access independent? Expected: it fetches from the original location with its own tools, not from a cache that a writer filled, otherwise it checks the entry against a copy of itself.
- **Level 4:** What metric tells you the verifier is doing useful work? Expected: the share of writes that are supersessions and the share of flagged entries, read together, with a rising flag rate as an early sign of a writer that hallucinates.

## Wrong answers

- "Let the checker fix the entry, since it has the source." The fix overwrites the audit trail and gives the checker a write path that a poisoned pool can turn against it.
- "A second reviewer agent that reads the pool is enough." A reviewer that only reads the pool compares entries with each other and inherits the same poisoned facts; the verifier must re-fetch the source.
- "Route the verifier's findings into the pool so every agent sees them." The findings then become shared facts, and a wrong finding poisons the pool in a new way; the finding on the verification channel, keyed by entry id, is the visible signal, not a new entry in the pool.

## Taught in

The [shared memory lesson](../../../phases/16-multi-agent-and-swarms/13-shared-memory-blackboard/) specifies the read-only verifier and its separate channel.
