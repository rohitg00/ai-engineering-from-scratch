---
id: riskiest-assumption-first
title: Pick the first experiment from a roadmap of features
card: behavioral
kind: design
level: 2
roles: [applied-ai-engineer, forward-deployed-ai-engineer, agentic-ai-engineer, ai-developer-relations-engineer]
rounds: [behavioral]
tags: [assumptions, risk, experiments, product-judgment]
minutes: 10
lessons: [phases/14-agent-engineering/49-map-assumptions-and-risk]
manuals: []
practice: []
cheatsheet: [product-discovery]
related: [behavioral/outcome-before-output, behavioral/smallest-slice-that-decides]
updated: 2026-11-03
---

You join a team with a quarter-long roadmap for an assistant that recommends a next action to on-call engineers. The roadmap lists features in priority order. Tell me how you decide what to work on in week one, and why it may not be the first roadmap item.

## Short answer

A roadmap hides uncertainty inside features. I rewrite the features as falsifiable assumptions about value, usability, feasibility, viability and safety, then score each one on impact, uncertainty and irreversibility. Week one goes to the cheapest decisive test of the highest open risk, which is often not the top roadmap item.

## Full answer

### Features are bets

The assistant only pays off if several conditions hold: alert context contains enough information to name a service, engineers trust a recommendation they did not derive, the response time matters operationally, the data is reachable without unsafe authority, and the workflow happens often enough to justify maintenance. None of these is an implementation task. They are conditions for the build to be worth doing.

### Five classes

| Class | Question |
|---|---|
| Value | Will the outcome matter enough? |
| Usability | Can the user understand and act on it? |
| Feasibility | Can the system produce it with the available data and limits? |
| Viability | Can the organization sustain the cost, the ownership and the operation? |
| Safety | Can it fail without an unacceptable consequence? |

An assumption has to be written so that it can be false. "The feature is useful" cannot be tested. "Eight of ten on-call engineers name the correct service faster with the read-only result" can.

### Risk is three numbers, not one

The lesson scores impact, uncertainty and irreversibility separately, each from one to five, multiplies impact by uncertainty and adds irreversibility. The formula is not sacred. Its job is to force the team to say why one unknown must be resolved before another. Irreversible, high-consequence choices need earlier evidence: a read-only replay can precede a production integration, and a human-approved recommendation can precede automatic action.

### An experiment, not a confirmation ritual

A useful test has a claim that could be false, a realistic sample, an observable result, a threshold decided before the result, and a next decision for pass, fail and ambiguous evidence. A demo that only shows the team can build the idea is not a test.

## Follow-ups

- **Level 2:** The highest-risk assumption is tested and holds. What changes? Expected: it moves from open to tested with its evidence attached, and the next experiment targets the next highest open risk.
- **Level 2:** Which assumption class do feature lists most often omit? Expected: safety, the question of whether the feature can fail without unacceptable consequence.
- **Level 3:** The roadmap owner says the ranking already reflects risk. How do you check? Expected: compare the risk ranking with the roadmap order and explain each mismatch; where they differ, one of them is wrong about the evidence.
- **Level 3:** Write a threshold that would stop the build. Expected: for example, fewer than a stated share of engineers in the replay trust the read-only recommendation enough to act on it.

## Wrong answers

- "Build the first roadmap item; the order was agreed." Agreement on order is not evidence that the riskiest assumption holds.
- "Ship something small and see what happens." A small build without a claim, a threshold and a next decision learns nothing.
- "Risk is just how likely it is to fail." Impact and irreversibility change the order even when the probability is the same.

## Taught in

The [assumption map lesson](../../../phases/14-agent-engineering/49-map-assumptions-and-risk/) gives the five classes, the three risk dimensions and the shape of a decisive experiment.
