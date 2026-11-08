---
id: design-a-research-team
title: Design a lead-and-workers research system for production
card: multi-agent
kind: take-home
level: 4
roles: [agentic-ai-engineer, forward-deployed-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [take-home, system-design]
tags: [supervisor, shared-memory, verifier, circuit-breaker, observability]
minutes: 60
lessons: [phases/16-multi-agent-and-swarms/05-supervisor-orchestrator-pattern, phases/16-multi-agent-and-swarms/13-shared-memory-blackboard, phases/16-multi-agent-and-swarms/23-failure-modes-mast-groupthink]
manuals: []
practice: []
cheatsheet: [multi-agent, research-agent-pipeline, agent-failure-modes]
related: [multi-agent/why-a-fresh-context-wins, multi-agent/the-verifier-that-cannot-write, multi-agent/the-retry-storm]
updated: 2026-11-03
---

Take-home. Design a research system in which one lead agent plans and several workers search in parallel, for a product where users ask open questions and expect a cited answer. Deliver a design document with the lead and worker prompts in outline, the shared memory, the failure modes you expect and the mitigation for each, the operational limits, and the cost model. Say what you would cut if the budget were halved.

## Short answer

The lead decomposes the question into sub-questions, scales the number of workers to the question's complexity, and synthesizes the worker summaries without reading raw sources. Each worker has a fresh context, an explicit scope, a timeout at about twice the median runtime and a token cap. Shared memory carries provenance on every entry, is append-only, and is checked by a read-only verifier that re-fetches sources and reports on its own channel. Every outbound call sits behind a circuit breaker, the system is deployed with versions side by side, and the cost model states up front that the pattern spends about 15 times the tokens of a single agent.

## Full answer

### The lead

- Prompt outline: decompose, delegate, synthesize, never research directly.
- Scale effort to the query: a simple question gets one agent and a few tool calls, and a complex one gets more than ten workers. The lead estimates this, not the caller.
- Decompose broad first, then spawn deeper workers where a sub-answer warrants it.
- Synthesis with provenance: every claim in the answer names the worker and the source it came from.
- Conflict handling: when two workers return contradictory facts, re-ask with a narrower question or surface the disagreement, never pick in silence.

### The workers

- Prompt outline: one sub-question, the sources to prefer, what is out of scope, the output shape.
- Fresh context per worker, so the lead's planning tokens never enter a worker's window.
- A timeout at about twice the median worker runtime, after which the lead re-spawns with a narrower scope or proceeds without the result.
- A hard token cap per worker, on the order of ten times the expected synthesis input, so one runaway worker cannot spend the budget.

### Shared memory

- Every entry carries the writer, the timestamp, the prompt hash and the source it cites.
- The log is append-only; a correction supersedes and references the entry it replaces.
- A read-only verifier re-fetches cited sources, flags mismatches, and writes only to a verification channel that the lead and a human read.
- Monitor the share of writes that are supersessions as an early sign of a hallucinating writer.

### Failure modes and mitigations

| Expected failure | Mitigation |
|---|---|
| The lead decomposes the wrong question | Log the decomposition and compare it with the user's question before workers start |
| Workers over-explore | Explicit scope, timeout and token cap |
| Two workers disagree | Detect by canonicalized claims per sub-question; re-ask or surface |
| Memory poisoning | Provenance, append-only, read-only verifier |
| Retry storm against a search or fetch service | Circuit breakers that open at 5 to 10 percent error rate and capped retry budgets |
| Silent wrong answer | A golden set of questions with known answers, run weekly, and sampled human review |

### Operations

- Trace the lead's plan, each worker's tool calls and the synthesis, so that a wrong answer can be traced to a worker and a source.
- Deploy new versions beside old ones and let long-running questions finish on the version they started on.
- Run the failure-mode audit each quarter on a sample of about 1000 traces and rank mitigations by failures removed.

### Cost model

State the measured multiplier: the pattern costs about 15 times the tokens of a single agent, and about 80 percent of the quality variance on a browsing benchmark is explained by token usage. Report tokens and wall-clock beside answer quality for every question class.

### With half the budget

Keep the lead's scaling rule and raise the complexity that a question must reach before the lead adds workers, so that more questions go to one agent. Keep provenance and the verifier, because they are cheap and they protect the cited answer. Cut worker count per question before you cut the verifier, and cut debate rounds entirely.

### What we grade

The outlined prompts, the memory schema with provenance fields, the failure table with one mitigation per row, the three operational limits with the reason for each number, and a cost section that shows the multiplier rather than hiding it.

## Follow-ups

- **Level 3:** Why does the lead never read raw sources, even to check a worker? Expected: its window is for planning and synthesis, and the check belongs to the verifier, which re-fetches the source without writing to the pool.
- **Level 3:** A worker returns a summary with no source. What does the design do with it? Expected: provenance marks the entry as uncited, the lead weighs it lower, and the verifier cannot check it, so the answer either omits it or labels it.
- **Level 4:** Which one component would you keep if you could keep only one beyond the lead and the workers? Expected: the read-only verifier with provenance, because a cited answer that is wrong is the failure the product cannot survive.
- **Level 4:** How do you know the system is still working next quarter? Expected: the golden set run weekly, the supersession and flag rates, the agreement rate across parallel workers, and the quarterly audit.

## Wrong answers

- "Give every worker the full conversation so it has context." That spends the fresh-context advantage and copies the lead's planning into every window.
- "Let the lead resolve conflicts by picking the better-written answer." A silent pick hides the disagreement from the user, and the design must re-ask or surface it.
- "Skip the verifier, because the lead already reads the worker summaries." The lead compares summaries with each other, not with the sources, and shared summaries can share a hallucination.

## Taught in

The [supervisor pattern lesson](../../../phases/16-multi-agent-and-swarms/05-supervisor-orchestrator-pattern/) gives the lead, the workers and the limits, the [shared memory lesson](../../../phases/16-multi-agent-and-swarms/13-shared-memory-blackboard/) gives the provenance fields and the read-only checker, and the [failure modes lesson](../../../phases/16-multi-agent-and-swarms/23-failure-modes-mast-groupthink/) gives the breaker and the audit.
