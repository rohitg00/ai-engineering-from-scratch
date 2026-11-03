---
id: exact-match-vs-token-f1
title: Exact match gives zero to a correct answer
card: evaluation
kind: concept
level: 1
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer, ai-data-engineer]
rounds: [screen, ml-breadth]
tags: [exact-match, token-f1, normalization, metrics]
minutes: 5
lessons: [phases/05-nlp-foundations-to-advanced/27-llm-evaluation-frameworks, phases/19-capstone-projects/41-eval-pipeline]
manuals: []
practice: []
cheatsheet: [llm-evaluation]
related: [evaluation/tokenizer-is-the-benchmark]
updated: 2026-11-03
---

Your question answering system returns "June 29th, 2007." The reference says "June 29, 2007." A teammate reports that this case gets a zero and asks you to replace the whole eval with token F1. What do you tell them?

## Short answer

Both metrics are right for different answer shapes. Exact match compares the whole string after normalization, so one extra character makes it zero. Token F1 compares the bags of tokens, so this pair scores about 75 percent. First add normalization to exact match, then pick the metric by the shape of the answers you grade.

## Full answer

### What each metric compares

Exact match normalizes both sides and then asks for equality. The capstone's exact match eval lowercases, strips the ends, collapses runs of whitespace and drops trailing terminal punctuation when the two sides differ only by it. After that step "Paris", "Paris." and "  paris  " all count as the same answer. The suffix in "29th" is not punctuation, so this pair still fails.

Token F1 splits both sides into tokens, counts the multiset intersection, and takes the harmonic mean of precision and recall. It forgives word order and paraphrase. It is fooled by lexical overlap: a prediction that shares most tokens with the reference but changes one fact still scores high.

### Which one to use

| Answer shape | Metric |
|---|---|
| A date, a number, a letter, a label | Exact match with normalization |
| A short phrase with several valid wordings | Token F1, best score over all references |
| A sentence or a paragraph | Token F1 as a floor, a calibrated judge for meaning |

### Why not switch everything

Token F1 pays for shared words, not for correctness. A long answer that repeats the question and then gives the wrong entity can score higher than a short correct answer. Keep exact match where the answer is deterministic. Use token F1 where paraphrase is normal. Use a judge where only meaning counts, and calibrate it first.

## Follow-ups

- **Level 1:** What does a token F1 of one mean? Expected: the prediction and the reference have the same multiset of tokens after normalization, in any order.
- **Level 2:** The reference is "Paris" and the prediction is "Paris." Which metric fails without normalization? Expected: exact match; with the trailing punctuation rule it passes.
- **Level 2:** When do you take the best score over several references? Expected: when a question has more than one valid answer string; the F1 and ROUGE-L metrics take the highest scoring target.
- **Level 3:** Token F1 is high and the answer is wrong. How did that happen? Expected: lexical overlap with wrong content, such as a wrong entity inside a sentence that shares most tokens with the reference; grade the entity with exact match or use a judge.

## Wrong answers

- "Exact match is broken, so remove it." Exact match with normalization is the right metric for dates, numbers and multiple choice letters; the missing step is normalization.
- "Token F1 understands meaning." It counts shared tokens; two answers with no shared tokens can both be right, and a wrong answer can share most tokens.
- "A human would give this 100, so always use a judge." A judge costs money and needs a calibration run; for a date, normalized exact match is free and exact.

## Taught in

The [LLM evaluation frameworks lesson](../../../phases/05-nlp-foundations-to-advanced/27-llm-evaluation-frameworks/) opens with this pair, and the [eval pipeline capstone](../../../phases/19-capstone-projects/41-eval-pipeline/) gives the normalization rules for exact match and token F1.
