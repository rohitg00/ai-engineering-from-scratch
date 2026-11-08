---
id: cot-when-it-hurts
title: Where step-by-step prompting helps and where it costs
card: prompting-structured-output
kind: concept
level: 1
roles: [applied-ai-engineer, agentic-ai-engineer, ai-developer-relations-engineer]
rounds: [screen, ml-breadth]
tags: [chain-of-thought, reasoning, latency, cost]
minutes: 7
lessons: [phases/11-llm-engineering/02-few-shot-cot]
manuals: []
practice: []
cheatsheet: [prompt-engineering]
related: [prompting-structured-output/self-consistency-at-temperature-zero, prompting-structured-output/few-shot-example-count]
updated: 2026-11-03
---

Your team adds "think step by step" to every prompt in the product, including a high-volume classifier and the calls to a reasoning model. Where does that help, where does it hurt, and why?

## Short answer

It helps on multi-step problems, where each reasoning token becomes context for the next one and the model computes its way to the answer. It hurts on simple recall and single-step classification, where it adds 50 to 200 tokens of reasoning per query for no gain, and on reasoning models, which already run a chain of thought internally and can get worse with the extra instruction. Pick the technique per task from the accuracy requirement, the latency budget and the cost.

## Full answer

### Why it works

A transformer without a visible chain has to compress all the reasoning into the hidden state of one forward pass. With the chain, the intermediate steps are tokens, and every token extends the context for the next. On the grade-school math benchmark the lesson shows one model moving from 78 percent zero-shot to 91 percent with the phrase alone and to 95 percent with worked examples.

### Where it does not pay

- **Simple factual recall and single-step classification.** There is nothing to reason through, and the chain is pure overhead.
- **High-throughput, low-complexity tasks.** The 50 to 200 extra tokens on every call are cost and latency.
- **Reasoning models.** They run the chain internally before they answer; the instruction is redundant and sometimes counterproductive.
- **Wide search problems.** On the lesson's arithmetic puzzle, standard prompting solved 7.3 percent of cases, a single chain solved 4.0 percent, and a tree search over branches solved 74 percent.

### Choose per task

| Technique | Calls | Token overhead | Fits |
|---|---|---|---|
| Zero-shot | 1 | none | simple tasks |
| Few-shot | 1 | 200 to 500 tokens | format matching |
| Zero-shot chain | 1 | 50 to 200 tokens | a quick reasoning lift |
| Few-shot chain | 1 | 300 to 600 tokens | the best single call |
| Self-consistency with 5 samples | 5 | five times the tokens | high-stakes reasoning |

## Follow-ups

- **Level 1:** Why does writing the steps out raise accuracy? Expected: each reasoning token becomes context for the next token, so the model computes the answer in steps instead of in one pass.
- **Level 2:** What does the classifier pay for the extra phrase? Expected: 50 to 200 tokens of reasoning per query, which at volume is cost and latency for no accuracy gain.
- **Level 2:** Why leave the phrase out for a reasoning model? Expected: it already runs its chain internally before the answer, so the instruction is redundant and sometimes counterproductive.
- **Level 3:** Is there a task where a single chain is worse than a plain answer? Expected: yes, the lesson's search puzzle, where the chain solved fewer cases than standard prompting and a tree search solved most.

## Wrong answers

- "It never hurts, worst case it is neutral." It costs tokens on every call, and it lowered accuracy on the wide search puzzle and on reasoning models.
- "Few-shot and chain of thought are the same thing." Few-shot shows examples; chain of thought shows reasoning; the two combine into few-shot chain of thought.
- "Always run it at temperature zero." A single chain at zero is fine, but sampling several chains for a vote needs temperature above zero, or every sample is identical.

## Taught in

The lesson [few-shot and chain-of-thought](../../../phases/11-llm-engineering/02-few-shot-cot/) gives the mechanism, the benchmark table, the cases where the chain hurts and the technique comparison.
