---
id: few-shot-example-count
title: How many examples go in the prompt, and which ones
card: prompting-structured-output
kind: tradeoff
level: 2
roles: [applied-ai-engineer, ai-developer-relations-engineer, forward-deployed-ai-engineer]
rounds: [screen, ml-depth]
tags: [few-shot, example-selection, context-budget, classification]
minutes: 7
lessons: [phases/11-llm-engineering/02-few-shot-cot, phases/11-llm-engineering/01-prompt-engineering, phases/11-llm-engineering/15-prompt-caching]
manuals: []
practice: []
cheatsheet: [prompt-engineering]
related: [prompting-structured-output/cot-when-it-hurts]
updated: 2026-11-03
---

A classification prompt has eight output labels. One engineer wants twenty examples in the prompt to be safe, another wants none and a longer instruction. How many examples do you include, which ones, and what decides it?

## Short answer

Three to five for most tasks, and for a classifier with many labels one example per label, so eight here. Pick examples that are semantically close to the input and that cover every label, because similar examples beat random ones by 5 to 15 percent on classification. Below three the model has too little signal to extract the pattern; above five you pay context tokens on every call for diminishing returns.

## Full answer

### Examples are compressed instructions

Instead of describing the format, you show it. Instead of explaining the reasoning, you demonstrate it. The model matches a pattern more reliably than it interprets an abstract rule. On simple sentiment tasks zero-shot and few-shot land within 2 percent of each other; on multi-step arithmetic and symbolic reasoning the examples add 10 to 25 percent.

### Which examples

1. **Semantic similarity.** Pick the examples closest to the input in embedding space. At request time this means a pool of labeled examples and a nearest-neighbor selection per query.
2. **Label diversity.** Cover every output category, or the model never sees that a label exists.
3. **Difficulty matching.** Match the complexity of the target problem.

### The cost side

Few-shot adds 200 to 500 tokens to every call. Two things keep that cheap. Hold the count at the knee, three to five. And if the examples are a fixed set, put them in the stable part of the prompt, after the system message and the tool definitions and before anything that changes per request, so a prefix cache serves them at the discounted rate. Examples picked per query by nearest neighbor change between requests, and a prefix cache stops at the first differing token. Put those below the cache breakpoint: the system message and the tool definitions above them still hit, and the examples pay the full rate.

### When zero-shot wins

Simple factual questions, creative tasks where examples constrain the output, and tasks where finding good examples is harder than writing a good instruction. The prompt engineering lesson still recommends two or three examples for a prompt that has to behave the same across providers, because examples transfer better than instructions alone.

## Follow-ups

- **Level 2:** When does zero-shot win? Expected: simple factual questions, creative tasks where examples constrain, and tasks where good examples are harder to find than a good instruction.
- **Level 2:** What do examples do that an instruction cannot? Expected: they show the format and the reasoning instead of describing them, and the model matches a shown pattern more reliably than it interprets a rule.
- **Level 3:** How do you choose the examples at request time? Expected: embed a labeled pool and select the nearest examples to the input while keeping label coverage; the lesson measured a 5 to 15 percent gain over random selection.
- **Level 3:** The examples cost 200 to 500 tokens on every call. How do you contain that? Expected: keep the count at three to five; place a fixed set of examples in the stable prefix so the prompt cache serves them at the discounted rate, and place examples picked per query below the breakpoint, because they change on every request.

## Wrong answers

- "More examples are always safer." Above five the returns diminish and every example costs context on every call.
- "Random examples are fine, the model generalizes." Similar examples beat random ones by 5 to 15 percent on classification.
- "Describe the labels in detail and skip the examples." For a format-sensitive task with many labels, examples transfer the pattern better than a description, and across providers too.

## Taught in

The lesson [few-shot and chain-of-thought](../../../phases/11-llm-engineering/02-few-shot-cot/) gives the counts and the selection principles, the lesson [prompt engineering](../../../phases/11-llm-engineering/01-prompt-engineering/) recommends examples for cross-provider prompts, and the lesson [prompt caching](../../../phases/11-llm-engineering/15-prompt-caching/) places them in the cacheable prefix.
