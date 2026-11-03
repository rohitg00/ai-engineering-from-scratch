---
id: pass-at-k-reading
title: Pass at one of 0.6 and pass at five of 0.95
card: evaluation
kind: tradeoff
level: 2
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer, applied-ai-engineer]
rounds: [ml-depth, design-review]
tags: [pass-at-k, agent-eval, verifier, variance]
minutes: 8
lessons: [phases/19-capstone-projects/27-eval-harness-fixture-tasks]
manuals: []
practice: []
cheatsheet: [eval-driven-agents, agent-benchmarks]
related: [evaluation/two-pass-at-k-formulas]
updated: 2026-11-03
---

Your coding agent scores a pass at one of 0.6 on the fixture suite and a pass at five of 0.95. One manager reads this as a failing agent; another reads it as a passing agent. What does each number tell you, and what do you put in the report?

## Short answer

Pass at one says the first sample fixes the task on about six tasks in ten. Pass at five says that at least one of five samples passes on almost every task, so the right answer is usually within reach and the gap is selection. Report both, with the raw pass counts per task, because pass at k alone hides an agent that succeeds once in twenty tries.

## Full answer

### What the harness computes

The harness runs each fixture task k times. Each sample goes through a deterministic verifier: a file equals an expected file, a regex matches, or a shell command exits zero. The per task pass rate p is passes over samples. Pass at k is the chance that k samples contain at least one pass. The harness also stores the raw counts, so a reviewer can see the variance behind the rate.

### Reading the gap

A low pass at one with a high pass at five says the agent is stochastic, not incapable. The fix is sampling plus ranking: generate several candidates and let a verifier choose. It is not always more training. Without a selector in production, the user receives the first sample, so pass at one is the number they feel.

### Why both numbers stay

Pass at k papers over a real failure. An agent that passes once in twenty tries has a respectable pass at twenty and is useless. The harness prints both so that neither manager can read the result alone.

### The rest of the report

The harness exists to stop three failures: an unverified pass, where the agent claims success and nobody checks; an undetected regression, where a prompt change makes the loud task 4 percent better and the quiet task 14 percent worse; and per task drift, where Monday ran 100 tasks and Friday ran 95 because five were renamed. So the report carries pass at one, pass at k, per task counts, mean and 95th percentile latency, and mean cost, over the same fixed task list every run.

## Follow-ups

- **Level 2:** What do you need in production to turn a high pass at five into a high pass at one? Expected: a verifier that selects the passing sample, such as tests that run; without it the user gets the first sample.
- **Level 2:** Why does the harness print raw pass counts next to the rate? Expected: to show variance per task and expose a task that passes once in many tries.
- **Level 3:** The pass rate rose from Monday to Friday while five fixtures were renamed. Is it real? Expected: no; the task set changed, so the runs are not comparable, and the harness must run every fixture every time in a fixed order.
- **Level 3:** Which three failure modes does the harness exist to prevent? Expected: unverified pass, undetected regression across tasks, and drift in the task set.

## Wrong answers

- "Pass at five is the real score." It measures the ceiling with selection; users get one sample unless you build the selector.
- "A pass at one of 0.6 means the agent is broken." It means the first sample fails on four tasks in ten; the high pass at five says the capability is there and selection is the gap.
- "Trust the agent's own success report." Self reported success is the first failure mode the harness exists to remove; a deterministic verifier decides.

## Taught in

The [eval harness with fixture tasks capstone](../../../phases/19-capstone-projects/27-eval-harness-fixture-tasks/) defines pass at one and pass at k and explains why both are reported.
