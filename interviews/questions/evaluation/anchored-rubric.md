---
id: anchored-rubric
title: Two engineers, one judge, different means
card: evaluation
kind: design
level: 2
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer, agentic-ai-engineer]
rounds: [design-review, ml-depth]
tags: [rubric, llm-as-judge, reproducibility, criteria]
minutes: 8
lessons: [phases/11-llm-engineering/10-evaluation]
manuals: []
practice: []
cheatsheet: [llm-evaluation]
related: [evaluation/judge-calibration-before-trust, evaluation/pairwise-position-bias]
updated: 2026-11-03
---

Two engineers ran the same judge on the same 100 answers with the instruction "rate from 1 to 5 how good the answer is" and got means almost a full point apart. How do you rewrite the rubric so the scores become reproducible, and what else goes into the judge prompt?

## Short answer

Anchor every level to behavior a reader can check. A rubric that states what a 5, a 4 and a 3 look like reduces judge variance by 30 to 40 percent compared with an unanchored scale. Score several criteria separately, give the judge the input, the output and the reference, and ask for the reasoning next to the number.

## Full answer

### From vague to anchored

The bad rubric asks how good the answer is. The good rubric describes each level:

- **5**: factually correct, directly addresses the question, includes specific details, gives actionable information.
- **4**: correct and on topic, but short on detail or slightly verbose.
- **3**: mostly correct with a minor inaccuracy, or partially misses the intent.
- **2**: significant factual errors, or only tangentially related.
- **1**: wrong, off topic or harmful.

### One criterion per score

Score relevance, correctness, helpfulness and safety on separate scales. A single overall score collapses the dimensions, and optimizing it produces terse answers that are technically right and useless.

### What the judge sees

The input, the output, the reference answer when one exists, and the anchored rubric for the criterion. Ask for a structured answer with the score and a short reason, so that a reviewer can audit the judge.

### Prove it

Run the judge three times on each case and compute an agreement statistic across the runs. Below 0.7 the rubric is still ambiguous. If the judge keeps wavering between two adjacent levels, switch that criterion to a pairwise comparison, which removes the scale.

## Follow-ups

- **Level 2:** Why score four criteria instead of one overall score? Expected: one score collapses dimensions; a model can be correct and useless, and the single number hides the trade.
- **Level 2:** How do you show the new rubric is reproducible? Expected: run the judge several times per case and compute an agreement statistic; below 0.7 rewrite again.
- **Level 3:** The judge still wavers between 3 and 4 on many cases. What design change removes that? Expected: pairwise comparison, which only asks which output is better.
- **Level 3:** One criterion has a reference answer and another has none. Does the rubric change? Expected: yes; correctness anchors to the reference, while helpfulness and safety anchor to properties of the output alone.

## Wrong answers

- "Lower the temperature of the judge." A deterministic judge still applies a vague scale differently across cases; the rubric is the fix.
- "Average more runs." Averaging noise costs money and leaves a scale that two readers interpret differently.
- "One overall score is simpler." Simpler to read and wrong to optimize; the lesson warns that single metric optimization produces terse useless answers.

## Taught in

The [evaluation and testing lesson](../../../phases/11-llm-engineering/10-evaluation/) gives the anchored rubric, the four criteria and the agreement check.
