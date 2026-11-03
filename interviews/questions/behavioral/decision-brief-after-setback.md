---
id: decision-brief-after-setback
title: Brief the decision owner after a setback
card: behavioral
kind: design
level: 3
roles: [forward-deployed-ai-engineer, applied-ai-engineer, ai-developer-relations-engineer, agentic-ai-engineer]
rounds: [behavioral, customer]
tags: [decision-brief, setback, authority, tradeoffs]
minutes: 12
lessons: [phases/14-agent-engineering/54-build-the-feedback-ratchet]
manuals: []
practice: []
cheatsheet: [decision-briefing-tools, product-discovery]
related: [behavioral/prototype-became-production, behavioral/feedback-ratchet-owner]
updated: 2026-11-03
---

Tell me about a project where the evidence turned against your plan. What did you do inside your own authority, and how did you present the situation to the person who had to decide?

## Short answer

I separate what I observed from what was reported and what I inferred, name the setback and the evidence that changed my understanding, and move the reversible work I am allowed to do while the blocked decision waits. Then I write a short brief for the decision owner: the user problem and the new evidence, at least two options including a cheaper manual or no-build option where it is credible, the tradeoffs in quality, effort, cost and risk, my recommendation with its remaining uncertainty, and the decision needed with its owner and date.

## Full answer

### Establish what happened

A setback is a failed assumption, an unusable result, an unexpected cost or a delayed handoff. I record the user, the task, the current workflow and the outcome I wanted, and link a consented observation, a redacted record or a reproducible trace. Simulated observations stay labeled as simulated. I do not invent interviews, approvals or adoption.

### Progress inside my authority

I list the unknowns and pick the cheapest reversible action that resolves the most consequential one. I state what I can decide, what an existing agreement bounds, and what needs authorization. Preparing a redacted offline replay while waiting for permission to use customer data is initiative. Expanding my own access is not.

### The brief

The brief is for someone who does not need the implementation detail:

- the user problem and the evidence that changed the plan;
- at least two options, with a cheaper manual or no-build option where it is credible;
- the tradeoffs in quality, interaction design, effort, operating cost and risk;
- my recommendation, the remaining uncertainty and the decision needed;
- the decision owner, the affected stakeholders and the date the decision is needed.

I ask a peer to represent an affected stakeholder and challenge one tradeoff, and I record whether the objection changes the recommendation. Role-play stays labeled; it cannot stand in for the real stakeholder's agreement.

### Close the loop

I recommend continue, change or stop against criteria declared in advance. If the evidence is inconclusive, I name the missing observation and the next bounded test. The decision owner's response goes in the record, or stays pending if none was made. Human review and correction time count as part of the workflow: a faster model response can still make the whole task slower or harder to trust.

## Follow-ups

- **Level 3:** Why include a no-build option whenever it is credible? Expected: narrowing the workflow or keeping a manual step can be the better decision; without that option the brief only asks for permission to continue.
- **Level 3:** What goes next to each number in the outcome comparison? Expected: the sample counts, the exclusions and the evidence links, with the same metric definition and comparable windows for baseline and follow-up.
- **Level 4:** A simulated walkthrough passed every step. What claim can you make? Expected: a bounded learning claim only; unobserved real-user behavior stays a named gap with the next observation needed to close it.
- **Level 4:** How do you turn the setback into a change in how the team delivers? Expected: pick one process improvement with an owner and a review date, then keep, revise or retire it on evidence.

## Wrong answers

- "Wait for the decision before doing anything." Reversible, authorized work can move forward; only the blocked decision waits.
- "Present the recommendation alone to keep it simple." The owner needs the options and the tradeoffs to make a decision rather than approve a conclusion.
- "Report the measured gain and leave out the review time." The complete task includes human review and correction; a faster model can still make the task slower.

## Taught in

The [feedback ratchet lesson](../../../phases/14-agent-engineering/54-build-the-feedback-ratchet/) gives the decision brief, the authority rule and the acceptance rubric.
