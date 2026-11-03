---
id: self-consistency-at-temperature-zero
title: Five votes, one path, five times the bill
card: prompting-structured-output
kind: debug
level: 2
roles: [applied-ai-engineer, agentic-ai-engineer]
rounds: [debugging, ml-depth]
tags: [self-consistency, temperature, chain-of-thought, cost]
minutes: 8
lessons: [phases/11-llm-engineering/02-few-shot-cot]
manuals: []
practice: []
cheatsheet: [prompt-engineering]
related: [prompting-structured-output/cot-when-it-hurts, prompting-structured-output/escalation-pipeline-cost]
updated: 2026-11-03
---

A math assistant samples five reasoning paths per question and takes a majority vote. Accuracy did not move compared with a single path, and the bill is five times higher. The team set the temperature to zero for reproducibility. What happened, and what else do you check before you keep the voting?

## Short answer

At temperature zero the samples should be identical, and only a nondeterministic serving stack makes them differ a little, so the five paths are close to one path counted five times and the vote changes almost nothing. The lesson samples at 0.7 so the paths differ enough for their errors to cancel. Then check that the final answer comes out in a fixed format, because without a line such as "The answer is" followed by the number the votes cannot be compared, and check that the single-path accuracy sits in the range where a vote helps, about 60 to 85 percent.

## Full answer

### What the vote needs

Self-consistency works because a single chain can contain a reasoning error while independent chains rarely make the same one. Independence comes from sampling. The lesson's solver runs the same prompt N times at temperature 0.7, extracts the final number from each, and takes the most common one. The vote share is the confidence.

### Where the lift is

In the original experiments on a 540B model, the vote moved the grade-school math score from 56.5 percent for one chain to 74.4 percent with 40 samples. On a model that already scores 97 percent, the vote adds about one point. The technique pays most when single-chain accuracy is between 60 and 85 percent: errors are frequent but not systematic.

### How many samples

Five samples capture most of the benefit. Three is the minimum for a meaningful vote. Beyond ten the returns diminish, and every sample is a full call. Reasoning models do their own internal sampling, so the vote adds little there.

### The format constraint

The system prompt asks for the final answer on the last line in a fixed form. Without it the extractor has nothing to compare, and a vote over free text is noise.

## Follow-ups

- **Level 2:** Why 0.7 and not something much higher? Expected: enough randomness for diverse paths and not so much that the model produces gibberish.
- **Level 2:** How are the five answers compared? Expected: the prompt forces a final line in a fixed form and the code extracts the number from it; without that, the vote has nothing to count.
- **Level 3:** When is the vote worth five times the cost? Expected: when single-chain accuracy is in the 60 to 85 percent range; on a model at 97 percent the lift is about one point.
- **Level 3:** How does the lesson turn the vote into a decision? Expected: the vote share is a confidence; with 4 of 5 in agreement, a confidence of 0.8, and a match with the deterministic answer, accept, otherwise escalate to a tree search.

## Wrong answers

- "Temperature zero makes the vote more reliable." It makes the samples the same or nearly the same, so there is no real vote.
- "Use forty samples like the paper." Five captures most of the benefit and more than ten shows diminishing returns; forty multiplies the cost for little gain.
- "Voting fixes a systematic error." If most paths make the same mistake, the majority is wrong with high confidence; the vote cancels independent errors only.

## Taught in

The lesson [few-shot and chain-of-thought](../../../phases/11-llm-engineering/02-few-shot-cot/) builds the self-consistency solver, sets the temperature and the format constraint, and gives the sample counts.
