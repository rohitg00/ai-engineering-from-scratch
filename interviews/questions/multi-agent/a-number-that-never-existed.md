---
id: a-number-that-never-existed
title: A number that never existed reached the final report
card: multi-agent
kind: debug
level: 2
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer, applied-ai-engineer]
rounds: [debugging, ml-breadth]
tags: [memory-poisoning, shared-state, provenance, append-only, verifier]
minutes: 10
lessons: [phases/16-multi-agent-and-swarms/13-shared-memory-blackboard]
manuals: []
practice: []
cheatsheet: [multi-agent, agent-failure-modes]
related: [multi-agent/two-workers-return-different-facts]
updated: 2026-11-03
---

Three agents share a memory on a research task. A retrieval agent reads a page and writes that a study found a 42 percent improvement. The page says 4.2 percent. A summarizer builds on the entry, an analyst recommends adoption on the strength of the number, and the final report cites it. No agent crashed and no test failed. What is this failure called, why is it structural, and what are the three changes that stop it?

## Short answer

This is memory poisoning. One agent's hallucination entered the shared state, and every agent downstream read it as a verified fact, so the error was turned into evidence as it moved. It is structural because any shared memory without provenance and without an independent verifier will do this eventually. The three changes are provenance on every write, an append-only log where corrections supersede instead of overwrite, and at least one read-only verifier that re-fetches sources and reports on a separate channel.

## Full answer

### Why it is worse than a crash

Without shared state, the retrieval agent's error stays in its own context, and a downstream agent that re-fetches the page might catch it. With shared state, the first agent's context becomes everyone's context. The symptom is a slow decay of accuracy, not a failure. By the time a human notices, the reasoning chain is several steps deep and the root cause is one of the first entries ever written. The lesson places this family second in the measured taxonomy of multi-agent failures.

### The three mitigations

| Change | What it does |
|---|---|
| Provenance on every write | Each entry records who wrote it, when, under what prompt, and which source it cites, so a downstream reader can weigh an entry by where it came from |
| Append-only with supersession | A correction is a new entry that points at the one it replaces, so the audit trail stays and a reader can see that a value was contested |
| A read-only verifier | An agent that reads the pool, re-fetches the cited sources, flags a mismatch, and has no write handle to the pool |

In the lesson's demo the verifier finds that the entry does not match the fetched text, the entry is flagged, and the analyst sees the flag before it writes its verdict.

### Why the verifier must not write

If the verifier's output goes back into the pool, a poisoned pool poisons the verifier, and the verifier's verdicts carry the poison further. Its findings go to a human or to a separate decision agent on their own channel. It can still be fooled by a bad entry, but it checks each entry against the original source, and its mistakes never become shared facts.

### What to monitor

Log the share of writes that supersede an earlier entry. A rising share is early evidence that agents are correcting each other more often, which is how poisoning shows up before anyone reads a wrong report.

## Follow-ups

- **Level 2:** Why does provenance help a reader who cannot re-fetch the source? Expected: the reader can see that one claim rests on one retrieval with no citation, and weigh it lower than a claim with a source and a verifier flag.
- **Level 2:** What does the analyst do when it sees a flag on the entry it depends on? Expected: it withholds the recommendation or writes it with the flag attached, and the final report carries a retraction instead of the number.
- **Level 3:** Which of the three changes would topic partitioning of the memory replace? Expected: none, because partitions limit which agents read an entry, and a poisoned entry in one topic still poisons everyone subscribed to it.
- **Level 3:** The verifier itself hallucinates a mismatch. What is the damage? Expected: a false flag on a correct entry, which a human on the verification channel can clear, and no new false fact in the pool because the verifier cannot write.

## Wrong answers

- "Add a line to every prompt that says to verify numbers." The summarizer and the analyst had no source to verify against, only the shared entry, and a prompt does not give them one.
- "Let the verifier correct the entry in place." An in-place correction destroys the audit trail and gives the verifier a write handle that a poisoned pool can turn against it.
- "Switch from a shared pool to passing messages." Messages are shared state with extra copying, and a wrong number in a message poisons the receiver the same way.

## Taught in

The [shared memory lesson](../../../phases/16-multi-agent-and-swarms/13-shared-memory-blackboard/) runs the poisoning scenario with and without the read-only verifier.
