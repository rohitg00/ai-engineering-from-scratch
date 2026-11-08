---
id: tokenizer-is-the-benchmark
title: BLEU 28.3 in one paper and 0.283 in another
card: evaluation
kind: debug
level: 2
roles: [ai-evaluation-reliability-engineer, ai-data-engineer, applied-ai-engineer]
rounds: [debugging, ml-depth]
tags: [bleu, rouge-l, tokenizer, reproducibility]
minutes: 8
lessons: [phases/19-capstone-projects/71-classical-metrics]
manuals: []
practice: []
cheatsheet: [llm-evaluation]
related: [evaluation/exact-match-vs-token-f1]
updated: 2026-11-03
---

Two papers report BLEU on the same test set. One says 28.3 and the other says 0.283. A third team reports a ROUGE-L score ten points below yours on the same outputs. Your manager asks which number is right. How do you answer?

## Short answer

All of them can be right for different metric setups. BLEU is a fraction, and one paper multiplies it by a hundred. ROUGE-L moves by ten points when one library lowercases and the other does not, or when the two tokenize differently. Read the metric setup before you compare, and in your own harness fix one tokenizer and one smoothing rule and pin them with tests.

## Full answer

### The scale

The two BLEU numbers are the same score on two scales. Nothing to debug; write the scale next to every number you publish.

### The tokenizer

The capstone uses one tokenizer for every metric: lowercase the text and keep runs of word characters. Every metric reads the same tokens. Swap the tokenizer and you run a different benchmark. The ten point ROUGE-L gap is what that swap looks like when one side keeps case and the other drops it.

### What else is inside the number

- **BLEU-4** counts modified n-gram precision for n from 1 to 4. The count of each candidate n-gram is clipped at its maximum count in any reference, so a candidate cannot win by repeating one phrase. The brevity penalty lowers the score of a candidate shorter than the reference. Add one smoothing on the counts avoids a log of zero when no 4-gram matches, and stays close to the unsmoothed value on long candidates.
- **ROUGE-L** finds the longest common subsequence. Recall is the subsequence length over the reference length, precision is the same over the candidate length, and the score is their F1.

### What to do in your harness

Write the metrics yourself so a colleague can audit them. Pin them with reference vectors from worked examples, not from a third party library. Test the edge cases: empty prediction, empty reference, no shared tokens, an exact match and a repeated phrase.

## Follow-ups

- **Level 2:** Why does clipping matter in BLEU? Expected: a candidate that repeats one matching phrase would inflate n-gram precision; clipping caps the count at the reference count.
- **Level 2:** What does the brevity penalty do? Expected: it lowers the score of a candidate shorter than the reference, so a short output cannot win on precision alone.
- **Level 3:** Why add one to the n-gram counts? Expected: a pair with no matching 4-gram would give a log of zero and a score of zero; smoothing keeps the geometric mean finite and barely moves long candidates.
- **Level 3:** How do you keep your metric numbers comparable across a year of runs? Expected: pin the tokenizer and the smoothing in code, keep reference vectors in tests, and record the metric version with every leaderboard.

## Wrong answers

- "Use the library everyone uses." Two libraries differ by ten points on the same outputs; you still need to know which tokenizer and casing each applied.
- "BLEU is old, drop it." It still backs most published numbers; learn to read it, then layer model based metrics on top.
- "Lowercasing cannot move a score by ten points." The capstone reports that it does for ROUGE-L across two libraries; casing changes which tokens match.

## Taught in

The [classical metrics capstone](../../../phases/19-capstone-projects/71-classical-metrics/) explains why the tokenizer is a contract and how BLEU and ROUGE-L are computed.
