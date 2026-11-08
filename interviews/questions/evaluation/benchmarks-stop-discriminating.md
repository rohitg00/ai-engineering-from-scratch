---
id: benchmarks-stop-discriminating
title: Two points on a saturated benchmark
card: evaluation
kind: concept
level: 1
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer, forward-deployed-ai-engineer, ai-developer-relations-engineer]
rounds: [screen, ml-breadth, customer]
tags: [benchmarks, contamination, saturation, model-selection]
minutes: 6
lessons: [phases/10-llms-from-scratch/10-evaluation]
manuals: []
practice: []
cheatsheet: [llm-evaluation]
related: [evaluation/benchmark-jump-capability-or-leak]
updated: 2026-11-03
---

A vendor shows you that their new model scores 89 percent on a public multiple choice benchmark and the model you run today scores 87. They say the gap proves the new model is smarter. Why are you not convinced, and what do you ask for instead?

## Short answer

Public benchmarks stop telling models apart once every frontier model sits in a narrow band near the top. Three mechanisms cause this: training data that contains the test, training mixes tuned to the test format, and saturation, where the questions that remain are ambiguous or mislabeled. A gap of two points in that band is noise or memorization. Ask for a run on your task with your data.

## Full answer

### The compression

The benchmark in the lesson has 15,908 questions across 57 subjects. Within three years the frontier models compressed into a 3-point range at the top. A model that scored 88.7 percent on it could not count the letters in a short word, a task that needs no world knowledge. The score measures the benchmark, not the job.

### Three mechanisms

1. **Data contamination.** Training corpora scrape the web, and the questions live on the web. Nobody has to cheat for the answers to end up in training.
2. **Teaching to the test.** Labs tune the training mix toward the format. On a 4-way multiple choice test, a model that learns the answer distribution gains points without knowing the answers.
3. **Saturation.** When every model scores 85 to 90 percent, the remaining 10 to 15 percent of questions are often ambiguous, mislabeled or obscure. Moving from 87 to 89 can mean two more memorized questions.

### What to ask for

- A custom eval on your task: at least 50 cases for a prototype and 200 or more for a production decision, with edge cases and adversarial inputs.
- Per-category results, not one aggregate.
- A contamination check: search the training corpus for the eval questions and close paraphrases.

Benchmarks still help with rough model selection. The final decision needs your eval.

## Follow-ups

- **Level 1:** Name the three categories of evaluation. Expected: public benchmarks, custom evals on your own data, and human evals.
- **Level 2:** A model does not know an answer. How does the test format still help it? Expected: the test has four options with a near uniform answer distribution, so format knowledge alone raises the score.
- **Level 2:** What are benchmarks still good for? Expected: rough model selection before you build a custom eval.
- **Level 3:** How would you test whether a benchmark leaked into training? Expected: search the training corpus for the eval questions and close paraphrases, and report the share that appears.

## Wrong answers

- "Two points on a standard benchmark is a real gap." At the top of a saturated benchmark the remaining questions are often ambiguous or obscure, so two points can be two memorized questions.
- "Labs cheat by training on the test." Web scale scraping pulls the questions in without intent; the effect is the same, and the fix is a contamination audit, not an accusation.
- "Use the coding benchmark instead." A function completion benchmark with 164 problems covers isolated function generation and says nothing about debugging or refactoring across files.

## Taught in

The [evaluation lesson in the LLMs from scratch phase](../../../phases/10-llms-from-scratch/10-evaluation/) explains contamination, teaching to the test and saturation.
