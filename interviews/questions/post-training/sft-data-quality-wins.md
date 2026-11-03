---
id: sft-data-quality-wins
title: A million scraped pairs or a small curated set
card: post-training
kind: tradeoff
level: 1
roles: [applied-ai-engineer, ai-data-engineer]
rounds: [screen, ml-breadth]
tags: [sft, data-quality, instruction-data, catastrophic-forgetting]
minutes: 8
lessons: [phases/10-llms-from-scratch/06-instruction-tuning-sft]
manuals: []
practice: []
cheatsheet: [llm-pipeline-capstone]
related: [post-training/sft-loss-mask]
updated: 2026-11-03
---

Your team has a budget to collect SFT data for a new assistant. One plan buys one million scraped question-answer pairs from the web. The other plan pays skilled writers for a much smaller set. Which plan do you pick, and how do you argue it?

## Short answer

Pick the smaller set from skilled writers. SFT teaches a behavior pattern, not new facts, so a few thousand to a few tens of thousands of clean examples are enough. The lesson's reference points are about 27,000 curated examples for the first SFT stage of a major open chat model, and 52,000 generated pairs that cost about 600 dollars and produced a usable assistant. Noise in scraped pairs is learned as behavior at the same weight as the good examples.

## Full answer

### Why a small set is enough

The base model already knows language and facts from pretraining. SFT concentrates a latent ability: when the assistant marker appears, answer. That pattern needs far fewer examples than learning facts. The lesson gives 20,000 to 100,000 crafted pairs as the range that turned a base model into an assistant, and points to a study where 1,000 carefully chosen examples matched much larger sets.

### Why noise hurts more than it helps

Every example is a target. Vague, wrong or rude answers in a scraped set teach vague, wrong or rude behavior, and the model has no way to know which examples to trust. SFT has no notion of a better answer. That comparison is what preference tuning adds later.

### What quality means in practice

- Diverse tasks and formats, not many copies of one shape.
- Answers that a careful person would write, in the length and tone you want in production.
- One consistent chat template, with the same role markers in every example.
- A filter that drops tiny answers and low vocabulary diversity before training.

### When volume does help

Once the format is learned, more clean examples broaden task coverage. The 70,000 shared conversations that trained an early open chatbot show that volume works when the source is already assistant-shaped. Mix 2 to 5 percent of raw pretraining text into the batches, so that the model keeps its general ability.

## Follow-ups

- **Level 1:** What does SFT not teach the model? Expected: new facts; those come from pretraining, and SFT teaches the response pattern.
- **Level 2:** How do you detect that a dataset teaches bad behavior before you train? Expected: sample and read it, score answer length and vocabulary diversity, check the ratio of instruction to answer, and drop the tail.
- **Level 2:** After SFT the model answers well but lost some coding ability. What in the data plan addresses that? Expected: mix a few percent of raw pretraining text into the SFT batches and keep the run short.
- **Level 3:** The writers produce long, detailed answers for everything. What is the risk? Expected: the model learns that length is the pattern, and later preference tuning can amplify it into verbosity; match the answer length to the product.

## Wrong answers

- "More data always wins in machine learning." SFT learns a format on a model that already knows the content; a million noisy targets teach noise as behavior.
- "Generated data is worthless, only human writing counts." The 52,000 generated pairs in the lesson produced a usable assistant for about 600 dollars; the issue is quality control, not the source.
- "Train longer on the small set to make up for its size." More than three epochs on a small set leads to memorization, and the model repeats training examples word for word.

## Taught in

The [SFT lesson](../../../phases/10-llms-from-scratch/06-instruction-tuning-sft/) compares the sizes of real instruction datasets and explains why quality matters more than quantity.
