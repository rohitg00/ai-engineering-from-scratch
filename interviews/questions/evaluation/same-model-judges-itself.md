---
id: same-model-judges-itself
title: The model that writes the answer grades it too
card: evaluation
kind: tradeoff
level: 2
roles: [ai-evaluation-reliability-engineer, applied-ai-engineer, agentic-ai-engineer]
rounds: [ml-depth, design-review]
tags: [llm-as-judge, self-preference, bias, calibration]
minutes: 8
lessons: [phases/05-nlp-foundations-to-advanced/27-llm-evaluation-frameworks, phases/10-llms-from-scratch/10-evaluation]
manuals: []
practice: []
cheatsheet: [llm-evaluation]
related: [evaluation/judge-calibration-before-trust]
updated: 2026-11-03
---

Your product generates answers with one model, and your eval pipeline grades them using that same model plus a rubric. Scores rose after the last release and the team is pleased. A reviewer asks why the gain might not be real. What is the risk, and what do you change?

## Short answer

A model that grades its own family prefers its own style, so self evaluation inflates scores by about 10 to 20 percent. The rise can mean the judge likes the new outputs more, not that users do. Move the judge to a different model family, calibrate it against human labels, and score the baseline and the new version again under that judge.

## Full answer

### Where the bias comes from

A judge is a model with preferences. It favors longer answers, answers from its own model family and answers that match the prompt style. When the judge comes from the generator's own family, every release that moves the output toward the judge's taste looks like an improvement. The lesson calls this self preference and measures the inflation at about 10 to 20 percent.

### Why the release looked better

A release changes tone, length and structure as well as content. The judge rewards the first three. Without a separate signal you cannot tell which part of the gain is content.

### What to change

1. Pick a judge from a different model family. Use the cheapest model that still meets the calibration threshold.
2. Calibrate it: hand label at least 50 cases, the lesson uses 100, and require a Spearman correlation of 0.7 or more with the human ranking.
3. Score the old and the new release under the same judge and report the difference, not the absolute score.
4. Normalize for length, or state in the rubric that length does not count.

## Follow-ups

- **Level 2:** Which two other judge biases does the lesson name next to self preference? Expected: position bias in pairwise comparison and verbosity bias toward longer answers.
- **Level 2:** The judge from another family is cheaper but correlates less with people. Which one do you take? Expected: the cheapest judge that still meets the calibration threshold; below the threshold the number is noise whatever the family.
- **Level 3:** You cannot change the judge family this quarter. What limits the damage? Expected: calibrate against human labels and publish the correlation, normalize for length, and read only relative changes under the frozen judge.
- **Level 3:** After the switch, how do you tell a real gain from a judge preference? Expected: both versions scored by the new judge, the difference with a confidence interval, and a human labeled slice of the cases that moved most.

## Wrong answers

- "The judge has a rubric, so its family does not matter." The rubric does not remove the preference for its own style; the lesson measures a 10 to 20 percent inflation.
- "Use the strongest model we have as the judge, which is the one we ship." Strength does not remove self preference; a different family at similar strength is the fix.
- "Scores went up, so quality went up." The score is a proxy; the output may have moved toward what the judge rewards, such as length and tone.

## Taught in

The [LLM evaluation frameworks lesson](../../../phases/05-nlp-foundations-to-advanced/27-llm-evaluation-frameworks/) lists self evaluation as a pitfall, and the [evaluation lesson](../../../phases/10-llms-from-scratch/10-evaluation/) names self preference among the judge failure modes.
