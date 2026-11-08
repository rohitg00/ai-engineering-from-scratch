---
id: smallest-slice-that-decides
title: Define the first slice so it can change the decision
card: behavioral
kind: design
level: 2
roles: [applied-ai-engineer, forward-deployed-ai-engineer, agentic-ai-engineer]
rounds: [behavioral]
tags: [mvp, slicing, stop-rule, product-judgment]
minutes: 10
lessons: [phases/14-agent-engineering/50-choose-the-smallest-testable-slice]
manuals: []
practice: []
cheatsheet: [product-discovery]
related: [behavioral/riskiest-assumption-first, behavioral/prototype-became-production]
updated: 2026-11-03
---

Your team agrees to ship a minimum viable version of a new assistant. Three proposals are on the table: a polished interface on synthetic data, a working data pipeline with no interface, and a read-only replay over ten real incidents. Which one do you argue for, and how do you justify the choice?

## Short answer

I argue for the replay over real incidents. Small is useful only when the slice proves something that matters, so I first write the required proof set from the highest-risk open assumptions and reject any candidate that does not cover it. The polished page over fake data and the pipeline without users each remove the exact uncertainty the team needs to test.

## Full answer

### Vertical means evidence end to end

A useful slice crosses the minimum real workflow needed to observe an outcome. It can be narrow in users, data, duration and capability. It must not be narrow by cutting out the uncertainty under test. The replay across ten real incidents tests service identification and operator trust at once. A polished page over fake data may test comprehension but not data feasibility. A production auto-remediator would test everything at once with unacceptable consequence.

### Required proof comes before scoring

I take the highest-risk open assumptions and turn them into a proof set. A candidate is eligible only if it covers that set. Among eligible candidates I compare outcome value, uncertainty reduced, effort, consequence and reversibility. The eligibility gate matters more than the arithmetic. A cheaper candidate that proves one required assumption stays ineligible even with a high score.

### False minimums I name in the room

- The interface-only minimum removes the data and operational uncertainty.
- The infrastructure-only minimum proves possibility without user value.
- The happy-path minimum omits the exception that creates most of the risk.
- The demo minimum produces a persuasive artifact but no repeatable measurement.
- The platform minimum builds reusable machinery before one workflow has earned it.

### The stop rule

Before anyone builds, I write what happens if the slice fails: abandon the outcome, change the target user, test a different mechanism, collect better evidence, or narrow authority further. If every possible result leads to "keep building", the slice is not an experiment.

## Follow-ups

- **Level 2:** The replay fails. Name two valid next moves. Expected: change the target user or situation, or test a different mechanism; both were written in the stop rule before the build.
- **Level 2:** Why does a replay beat a live pilot here? Expected: it produces reversible evidence about trust and identification without exposing real users to a system nobody has measured.
- **Level 3:** A reusable component would speed up all three proposals. When does it get built? Expected: after the slice has produced decisive evidence; building platform machinery first is the platform minimum.
- **Level 3:** How do you keep the replay from becoming a demo? Expected: a repeatable measurement with a threshold decided in advance, not a persuasive walkthrough.

## Wrong answers

- "The smallest build is the one with the fewest features." Smallness is measured by the evidence gained, not by the feature count.
- "Build the interface first so stakeholders can see progress." A persuasive artifact without a measurement is the demo minimum.
- "If the slice fails we iterate." Without a written stop rule, every result leads to more building and nothing was tested.

## Taught in

The [smallest slice lesson](../../../phases/14-agent-engineering/50-choose-the-smallest-testable-slice/) gives the required proof gate, the false minimums and the stop rule.
