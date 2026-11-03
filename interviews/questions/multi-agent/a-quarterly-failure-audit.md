---
id: a-quarterly-failure-audit
title: Design the quarterly failure audit for an agent team
card: multi-agent
kind: design
level: 4
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [system-design, design-review]
tags: [mast, failure-audit, verification-gap, slow-failure, golden-dataset]
minutes: 15
lessons: [phases/16-multi-agent-and-swarms/23-failure-modes-mast-groupthink]
manuals: []
practice: []
cheatsheet: [agent-failure-modes, multi-agent]
related: [multi-agent/the-retry-storm, multi-agent/a-number-that-never-existed]
updated: 2026-11-03
---

A multi-agent product has been in production for two quarters. Failures arrive as a stream of unrelated tickets and nothing gets fixed systematically. Design the audit that turns the stream into a ranked list of fixes, and say which failure class you would weight most heavily even if it is not the most frequent.

## Short answer

Sample about 1000 real execution traces each quarter, categorize every failure into the three root categories of the published taxonomy and the five groupthink patterns, compute the failure rate per category, rank the mitigations by how many failures each would remove, and commit to two or three for the quarter. Weight verification gaps most heavily even though they were the smallest category by count, because they are silent: a plausible wrong output produces no exception, no alert and no ticket until a human notices.

## Full answer

### The baseline you are measured against

The reference taxonomy was built from 1642 execution traces across 7 open-source multi-agent systems and found failure rates between 41 percent and 86.7 percent. Three root categories:

| Category | Share | What it looks like |
|---|---|---|
| Specification problems | 41.77 percent | Role ambiguity, an underspecified task, implicit success criteria |
| Coordination failures | 36.94 percent | Unsynchronized writes to shared state, lost messages, state drift |
| Verification gaps | 21.30 percent | One agent claims success and nobody checks, each agent trusts the one before |

Beside them sit the five groupthink patterns: monoculture, conformity, a missing model of each other's beliefs, compromise drift and cascading failures.

### The audit, step by step

1. **Sample.** Pull about 1000 real traces, stratified by task type, not the ones that produced tickets.
2. **Categorize.** Map each failure to a root category and any groupthink pattern. Two reviewers per trace until the categories are stable.
3. **Compute.** Failure rate per category for your system. The published shares are a prior, not your number.
4. **Rank.** For each candidate mitigation, count the failures it would have removed.
5. **Commit.** Two or three mitigations for the quarter, each with an owner and a re-audit date.

The discipline matters more than the choices. Without the audit, failures blend into noise.

### The mitigation menu

- Specification: explicit role contracts that say what an agent does and does not do, acceptance tests written before dispatch, a pre-flight check of the task definition.
- Coordination: versioned shared state with optimistic concurrency, acknowledgments for critical messages, periodic state-sync checkpoints.
- Verification: an independent read-only verifier with its own source access, handoff contracts that require a check before the next agent starts, outcome logging.
- Cascades: circuit breakers on every outbound call with a default open threshold at 5 to 10 percent error rate, and capped retry budgets.

### Why verification gaps weigh more

A loud failure, a crash or a timeout, is cheap to detect. A silent correctness failure cannot be found in exception logs. That is why verification gaps are the most expensive category per failure. Invest in sample-based human review, a small hand-audited golden dataset run weekly, and cross-checks between agents on important outputs.

### Catch slow failures before the audit

Instrument proxies for drift: the agreement rate across parallel agents, the retry rate, the distribution of output lengths, and the edit distance between successive agent versions. The lesson also describes a trio of specialized agents, detection, diagnosis and validation, that improved mitigation success by 1.5 times; start with detection only and add diagnosis when the symptoms are noisy.

### Make it binding

Set a failure budget per category, an explicit objective for the rate. When a category exceeds its budget, the next release waits.

## Follow-ups

- **Level 3:** Why sample traces instead of auditing tickets? Expected: tickets are the loud failures, and the silent ones never produce a ticket, so a stratified sample is the only way to see them.
- **Level 3:** Which single proxy would you instrument first? Expected: agreement rate across parallel agents, because a sharp rise signals conformity and a sharp fall signals drift, and both precede visible errors.
- **Level 4:** The audit finds that specification problems dominate. What is the cheapest fix? Expected: a pre-flight check of the task definition by a separate agent before dispatch, with role contracts that include what each agent does not do.
- **Level 4:** How do you keep the audit from becoming a report nobody acts on? Expected: the failure budget with a stop-shipping rule, owners per mitigation, and the re-audit date on the calendar before the quarter starts.

## Wrong answers

- "Fix the most frequent category first." Frequency is not cost, and the silent verification gaps cost more per failure than the loud specification problems.
- "Audit once a year, when the system is stable." Categories shift as the system grows, and a year of unranked failures is the stream you started with.
- "Add more agents to check each other." Agents that share a model share their blind spots, and the check that matters is an independent verifier with its own source access.

## Taught in

The [failure modes lesson](../../../phases/16-multi-agent-and-swarms/23-failure-modes-mast-groupthink/) gives the taxonomy, the audit steps and the slow-failure proxies.
