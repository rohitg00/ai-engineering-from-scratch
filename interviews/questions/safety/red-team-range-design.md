---
id: red-team-range-design
title: A red team range that runs without you
card: safety
kind: design
level: 4
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer, agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [system-design, design-review]
tags: [red-team, attack-families, over-refusal, cvss, self-critique]
minutes: 15
lessons: [phases/19-capstone-projects/15-constitutional-safety-harness, phases/19-capstone-projects/82-jailbreak-taxonomy, phases/19-capstone-projects/84-refusal-evaluation]
manuals: []
practice: []
cheatsheet: [guardrails-moderation, constitutional-classifiers]
related: [safety/safety-eval-missing-pieces, safety/six-jailbreak-categories]
updated: 2026-11-03
---

You own safety for a customer facing assistant built on an open weight model behind a retrieval pipeline. Design the red team range that runs without you: the attack families, the schedule, what counts as a finding, how you keep the assistant helpful while you harden it, and how you prove that a training time intervention helped.

## Short answer

Schedule at least six attack families on separate queues: automated jailbreak search, tree search attacks, gradient suffix attacks, encoding attacks, multi turn persona attacks and code switching across languages, each reporting a success rate. Every success becomes a finding with a taxonomy id, a severity score and a disclosure timeline. Track over refusal on a benign probe suite next to the block rate so the trade off sits on one chart, and prove a self critique intervention with a before and after harmlessness delta on a held out set.

## Full answer

### The target and its layers

The assistant sits inside a layered pipeline: input sanitizing that strips zero width characters and decodes common encodings, policy rails, a classifier gate, the model, an output filter with personal data scrubbing, and a human review tier for flagged outputs. The range attacks the whole stack, not the bare model, because the stack is what users reach.

### The attack families

| Family | What it does |
|---|---|
| automated jailbreak search | an attacker model rewrites prompts until one lands |
| tree search attacks | the same search with branching and pruning |
| gradient suffix attacks | adversarial suffixes optimized against an open weight model |
| encoding attacks | base64, rot13 and character tricks against the sanitizer |
| multi turn persona | warm up turns, then a persona and a ramp |
| code switching | mixing languages to slip past an English classifier |

Report a success rate per family. The capstone's example run shows 7 successes in 50 attempts, a 14 percent rate, with one roleplay bypass scored at a medium 4.8. A retrieval pipeline adds a seventh family the capstone sets as an exercise: indirect injection through retrieved documents, with its own extra defense.

### The finding record

A structured record with the taxonomy id, the attack family, a severity on the standard vulnerability scale from attack vector, complexity and impact, the disclosure timeline and a mitigation plan. Findings write to a queue. A screenshot is not a finding.

### Staying helpful

Run a benign probe suite on the same schedule and track the over refusal rate. Alert on regression. Grade the harness on the trade off, block rate against benign pass rate, so that a gain on one side that costs the other is visible. Consider a refuse with help mode and measure its effect on the benign suite.

### Proving the intervention

Curate about a thousand harmful attempt prompts. The model drafts, a critic scores the draft against a written constitution, failing drafts are rewritten, and the model is fine tuned on the improved pairs. Measure harmlessness before and after on a held out eval, next to the benign pass rate before and after. The capstone weights this delta at 20 of 100 points, with coverage of six or more families in two or more languages at 25, the trade off at 20, documentation at 20 and automation at 15.

## Follow-ups

- **Level 3:** Why does each attack family run on its own queue? Expected: the drivers differ in cost and runtime, so a slow gradient attack must not block the cheap encoding sweep, and per family rates need per family runs.
- **Level 4:** Which family does the retrieval pipeline add that the six do not cover? Expected: indirect injection through retrieved documents, measured as a seventh family with its own extra defense.
- **Level 4:** How do you show the self critique training helped rather than raised refusals? Expected: the harmlessness delta on a held out eval next to the benign pass rate before and after; a gain that comes with a benign drop is over refusal, not safety.

## Wrong answers

- "Run the red team once before launch." Attacks evolve; the range runs on a schedule and the findings feed the next sprint.
- "Block rate is the metric." Block rate against benign pass rate is the metric; a model that blocks everything has a perfect block rate.
- "A finding is a screenshot of the bad output." A finding carries a taxonomy id, a severity score, a timeline and a mitigation, or nobody can act on it.

## Taught in

The [constitutional safety harness capstone](../../../phases/19-capstone-projects/15-constitutional-safety-harness/) sets the layers, the attack families, the scoring and the self critique delta, the [jailbreak taxonomy capstone](../../../phases/19-capstone-projects/82-jailbreak-taxonomy/) supplies the ids that findings reference, and the [refusal evaluation capstone](../../../phases/19-capstone-projects/84-refusal-evaluation/) defines the over refusal rate.
