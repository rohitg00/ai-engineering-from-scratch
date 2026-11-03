---
id: two-workers-return-different-facts
title: Two workers returned different facts, the report shows one
card: multi-agent
kind: debug
level: 3
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, design-review]
tags: [synthesis-conflict, supervisor, provenance, worker-timeout, scope]
minutes: 12
lessons: [phases/16-multi-agent-and-swarms/05-supervisor-orchestrator-pattern]
manuals: []
practice: []
cheatsheet: [multi-agent, research-agent-pipeline]
related: [multi-agent/why-a-fresh-context-wins]
updated: 2026-11-03
---

In a lead-and-workers research system, two workers answered overlapping sub-questions with numbers that contradict each other. The final report contains one of the numbers and no mention of the other. The user found the second number in a source and asks why the report hid it. Where did the system fail, and what do you change?

## Short answer

The lead resolved a synthesis conflict by picking one side in silence, which the lesson calls the worst failure in this pattern, because the user never learns that a disagreement happened. Two upstream causes made it likely: the decomposition gave two workers the same ground, and no worker had a scope that stopped it from drifting into the other's territory. The fix is a lead that detects contradiction between worker outputs and either re-asks with a narrower question or writes the disagreement into the answer, plus provenance on every synthesized claim.

## Full answer

### Three failure modes in the pattern

| Failure | What happened here |
|---|---|
| The lead hallucinates the plan | Sub-questions overlapped, so two workers researched the same fact |
| Workers over-explore | A worker without a scope boundary drifted past its question into another's |
| Synthesis conflict | Two contradictory facts arrived, and the lead picked one without a note |

The third is the one the user saw. The first two made it happen.

### Detect the conflict without a model

The lesson asks how to detect contradiction without a model call. Canonicalize the claims: extract each number with its unit and the entity it describes, key it by sub-question, and compare. Two different values under one key is a conflict. For non-numeric claims, flag a key only when the two workers state different claims. Different cited sources alone are not a conflict. Let the lead handle a flagged key.

### What the lead does with a conflict

1. **Re-ask.** Spawn a worker on a tighter question aimed at the disagreement, which adds a round.
2. **Surface it.** Write both values into the answer with their sources and say that they disagree.
3. **Never pick in silence.** A chosen value with no note is the failure in the prompt.

### Prevent the overlap

Decompose broad first and narrow later, and give each worker an explicit scope in its prompt: the sub-question, what is out of scope, and the sources to prefer. Add a worker timeout at about twice the median runtime and a token cap per worker, so that a worker that wanders is cut and the lead re-spawns with a narrower question or proceeds without it.

### Provenance on the synthesis

Each claim in the final answer carries the worker and the source it came from. That makes the hidden second number impossible, because a claim with two sources shows two values, and it makes the post-mortem a read of the trace instead of a guess.

## Follow-ups

- **Level 3:** Why is a silent pick worse than a wrong pick with a note? Expected: a noted disagreement lets the reader check the sources, while a silent pick presents an unresolved fact as settled.
- **Level 3:** The re-ask adds a round and the latency target is tight. What do you do? Expected: surface the disagreement in the answer instead of re-asking, and record the key for a later run.
- **Level 4:** How do you test the conflict detector? Expected: feed it worker outputs with a planted contradiction on one key and matching values on others, and assert that exactly that key is flagged.
- **Level 4:** The two workers agree and are both wrong. What catches that? Expected: nothing in the lead, because agreement is not correctness, so an independent verifier with its own source access has to check the claim.

## Wrong answers

- "Add a rule to the lead's prompt that says be careful with numbers." The lead did not know a conflict existed, and a prompt does not compare worker outputs.
- "Trust the worker with the higher confidence." Confidence is not correctness, and the user still never learns that a disagreement happened.
- "Run three workers per sub-question and take the majority." A majority can be wrong together, it triples the cost, and the overlap that caused the conflict stays in the plan.

## Taught in

The [supervisor pattern lesson](../../../phases/16-multi-agent-and-swarms/05-supervisor-orchestrator-pattern/) names the synthesis conflict and the worker timeout and token cap.
