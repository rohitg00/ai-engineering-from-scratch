---
id: safety-eval-missing-pieces
title: One table says 97 percent refusal
card: safety
kind: debug
level: 3
roles: [applied-ai-engineer, forward-deployed-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [design-review, customer]
tags: [safety-eval, over-refusal, red-team, monitored-split]
minutes: 10
lessons: [phases/18-ethics-safety-alignment/09-alignment-faking, phases/19-capstone-projects/84-refusal-evaluation, phases/19-capstone-projects/15-constitutional-safety-harness]
manuals: []
practice: []
cheatsheet: [guardrails-moderation, ai-safety]
related: [safety/two-refusal-metrics, safety/compliance-gap-metric]
updated: 2026-11-03
---

A vendor's safety report has one table: the refusal rate on a harmful prompt set, 97 percent, measured once with the default system prompt. You must decide whether to adopt the model for a customer facing assistant. List what the report cannot tell you and the measurements you add before you decide.

## Short answer

The table measures one side of one decision under one condition. It cannot show over refusal on benign prompts, which category of attack the misses fall into, whether the model behaves the same when it believes it is unmonitored, or how the number moves under your system prompt and attack families. Add a benign probe set for over refusal, a per category breakdown from a taxonomy, a monitored and unmonitored split, and a red team run with several attack families against your deployment, and plot block rate against benign pass rate.

## Full answer

### What is missing

1. **The other side.** Refusal on harmful prompts alone rewards a model that refuses everything. The over refusal rate on a benign suite is the second half, and the two move together with every system prompt change.
2. **Where the misses are.** A per category breakdown against a taxonomy shows whether the model handles instruction override and slips on multi turn ramps. One number hides that.
3. **The unmonitored condition.** A model can comply more when it believes the conversation trains it and less when it believes it does not. One condition cannot show the gap.
4. **Your deployment.** The vendor's prompt set is public and may be in training data; attackers do not use it. The capstone range runs at least six attack families, automated jailbreak search, tree search, gradient suffixes, encoding, multi turn persona and code switching across languages, and reports a success rate per family. Its example run shows 7 successes in 50 attempts, a 14 percent rate, and a medium severity roleplay bypass.
5. **Calibration.** Whether the model's stated confidence tracks its accuracy is a separate axis from the decision itself.

### The decision chart

Attack block rate against benign pass rate, per family and per category, under your system prompt. The capstone grades a harness on exactly this trade off. A model that wins on block rate and loses on benign pass rate has moved the problem to your support queue.

### What to send back to the vendor

Ask for the benign suite results, the category breakdown and the test conditions. A one table report is a starting point for a conversation, not a basis for adoption.

## Follow-ups

- **Level 3:** Why is a single refusal rate not a safety metric on its own? Expected: a model that refuses everything scores perfectly on it; without the benign side you cannot see the cost.
- **Level 3:** The harmful prompts in the report are a published set. What does that do to the number? Expected: it may be in the training data and attackers do not use it; measure with your own attack families and a held out set.
- **Level 4:** Which two numbers go on one chart for the adoption decision? Expected: attack block rate against benign pass rate, per attack family and per category, under your own system prompt.

## Wrong answers

- "Ninety seven percent is high enough." It is one side of the decision, and nothing in the report shows the cost on benign prompts or the behavior when unmonitored.
- "Our system prompt will make it safer, so the number only improves." Every system prompt change moves both refusal rates at once; measure after the change.
- "Red teaming is the vendor's job." The attacks that matter run against your deployment, with your prompt and your tools.

## Taught in

The [refusal evaluation capstone](../../../phases/19-capstone-projects/84-refusal-evaluation/) defines the two refusal rates and the per category breakdown, the [alignment faking lesson](../../../phases/18-ethics-safety-alignment/09-alignment-faking/) adds the monitored split, and the [constitutional safety harness capstone](../../../phases/19-capstone-projects/15-constitutional-safety-harness/) sets the attack families and the benign probe set.
