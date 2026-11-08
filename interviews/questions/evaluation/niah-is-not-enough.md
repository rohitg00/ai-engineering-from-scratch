---
id: niah-is-not-enough
title: A perfect needle test and a long contract
card: evaluation
kind: concept
level: 2
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer, forward-deployed-ai-engineer]
rounds: [ml-breadth, system-design]
tags: [long-context, niah, ruler, effective-context]
minutes: 8
lessons: [phases/05-nlp-foundations-to-advanced/28-long-context-evaluation]
manuals: []
practice: []
cheatsheet: [llm-evaluation]
related: [evaluation/effective-context-spec-sheet]
updated: 2026-11-03
---

A model card advertises a context window of one million tokens and a perfect score on a needle in a haystack test at that length. Your product asks the model to reconcile figures that appear in several places across a long contract. Does the card answer your question, and what do you measure instead?

## Short answer

No. A single needle test measures retrieval of one planted fact, and frontier models saturate it. Your task is multi hop aggregation, which degrades sharply past about 128k tokens on most models. Run a multi hop test at your target length and report two numbers: the effective retrieval length and the effective reasoning length.

## Full answer

### What the needle test measures

Place one fact at a controlled depth in filler text and ask for it. Sweep depth and length. It is the baseline, and it is necessary but not sufficient. Single needle success does not predict multi needle success, and neither predicts reasoning over dispersed facts, which is the first task to fail.

### What the harder benchmarks add

- A multi task suite with 13 task types across retrieval, multi hop tracing, aggregation and question answering. In its first release only half of 17 models that claimed 32k context kept their quality at 32k.
- A multi round coreference test with 8, 24 or 100 needles, which shows how many facts a model can hold at once. On one advertised 10M token model, the 8 needle variant fell to 26.3 percent at 1M tokens.
- Non lexical needles that share no words with the query, so retrieval needs one reasoning step.

### The two numbers for your spec sheet

1. **Effective retrieval length**: the longest context where the needle test still passes at a threshold such as 90 percent.
2. **Effective reasoning length**: the longest context where a multi hop or aggregation task passes at a threshold such as 70 percent. It is usually 25 to 50 percent of the advertised window.

### Build the test for your contract

Plant three linked assignments in filler, such as a value, a second value defined from the first and a third defined from the second, and ask for the last one. Test depths 0, 0.25, 0.5, 0.75 and 1.0 at each length. Use needles that do not share keywords with the filler. Record the time to first token with every run; a million token prompt can take 30 to 120 seconds to prefill.

## Follow-ups

- **Level 2:** Why does a single needle pass not predict a three needle pass? Expected: several facts need attention at several positions at once; the multi needle test measures juggling, not retrieval.
- **Level 2:** Which depths do you test? Expected: 0, 0.25, 0.5, 0.75 and 1.0, because models under attend to the middle of the input.
- **Level 3:** The planted fact uses the same words as the surrounding text. What goes wrong? Expected: retrieval becomes trivial lexical matching; use a needle with no literal overlap.
- **Level 3:** What do you measure next to accuracy at the target length? Expected: time to first token and cost per query; a million token prompt can take 30 to 120 seconds to prefill.

## Wrong answers

- "The vendor's score is independent evidence." Vendors publish their own scores; rerun on your task at your length.
- "Pass at one million means pass at every shorter length and every task." Report the curve per task type; an aggregate hides large task level differences.
- "Test the middle depth only." Many implementations do; the middle is where models under attend, so test five depths.

## Taught in

The [long context evaluation lesson](../../../phases/05-nlp-foundations-to-advanced/28-long-context-evaluation/) names the benchmarks and the two numbers for a spec sheet.
