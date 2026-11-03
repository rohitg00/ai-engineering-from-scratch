---
id: escalation-pipeline-cost
title: Make each reasoning stage earn its cost
card: prompting-structured-output
kind: tradeoff
level: 4
roles: [applied-ai-engineer, agentic-ai-engineer]
rounds: [system-design, ml-depth]
tags: [self-consistency, tree-of-thought, cost, latency, escalation]
minutes: 15
lessons: [phases/11-llm-engineering/02-few-shot-cot]
manuals: []
practice: []
cheatsheet: [prompt-engineering]
related: [prompting-structured-output/self-consistency-at-temperature-zero, prompting-structured-output/cot-when-it-hurts]
updated: 2026-11-03
---

A team runs every question through the full escalation pipeline from the lesson: one deterministic chain, then five sampled chains with a vote, then a tree search when the vote is weak. Latency and cost are now the top complaint. As the staff engineer, how do you restructure the pipeline, and what do you measure to defend the new shape?

## Short answer

Make the pipeline earn each stage. Most questions should end at the cheap stage, so start the vote at the minimum of three samples and widen it only on disagreement, and reserve the tree search, which costs up to 39 calls at a branching factor of 3 and a depth of 3, for the questions where the vote fails. Measure accuracy against cost per question for each stage on a held-out set, and report the share of questions that each stage resolves.

## Full answer

### What the lesson's pipeline does

The deterministic chain runs once. The vote runs five samples at temperature 0.7 and accepts when 4 of 5 agree, a confidence of 0.8, and the majority matches the deterministic answer. Anything else goes to the tree search, where every node is a model call.

### Where the money goes

| Stage | Calls | Token overhead |
|---|---|---|
| One few-shot chain | 1 | 300 to 600 tokens |
| Vote over five chains | 5 | five times the tokens |
| Tree search | 10 to 40 or more | 10 to 40 times the tokens |
| A reasoning model | 1 | hidden, 2 to 10 times internal |

Run on every question, the vote alone multiplies the bill by five, and the tree search is unbounded in the tail.

### The restructure

1. **Route by task first.** Simple recall and single-step classification get a single zero-shot call; the chain and the vote are for multi-step problems.
2. **Vote small, widen on doubt.** Three samples is the minimum for a meaningful vote and five captures most of the benefit; start at three and add samples only when the three disagree.
3. **Cap the tree.** Keep it for problems with a large but evaluatable search space, set a call budget per question, and report how often the budget is hit.
4. **Test a reasoning model as a drop-in.** It runs the chain internally and subsumes the vote on many tasks; its hidden cost belongs on the same curve as the other stages.

### What defends it

- The accuracy against total tokens curve from a sweep of N over 1, 3, 5, 7 and 10 on a held-out set, with the knee marked.
- The share of questions resolved at each stage, and the accuracy of each stage on the questions it resolved.
- The share of questions that only the tree search gets right, against its share of the bill.

## Follow-ups

- **Level 3:** What does the tree search cost at the lesson's defaults? Expected: each node is a model call, so a branching factor of 3 and a depth of 3 means up to 39 calls.
- **Level 4:** Where does a reasoning model fit in the new shape? Expected: as a drop-in for the chain and the vote on many tasks, one call with hidden internal reasoning at 2 to 10 times the tokens, compared on the same accuracy against cost curve.
- **Level 4:** How do you pick the vote size? Expected: sweep N over 1, 3, 5, 7 and 10 on a held-out set and plot accuracy against total tokens; the lesson puts the knee near 5 and the minimum meaningful vote at 3.
- **Level 4:** Which one number justifies keeping the tree search at all? Expected: the share of questions that only the tree search gets right, against its share of the bill; if that share is near zero, cut the stage.

## Wrong answers

- "Run the tree search on everything for the best accuracy." It costs 10 to 40 or more calls per question, and the lesson keeps it for large, evaluatable search spaces.
- "Drop the vote and keep one chain at temperature zero." One chain is cheap but carries no confidence signal; the vote share is what tells you when to stop or escalate.
- "Set the confidence gate to 1.0 to be safe." Then any single disagreement triggers the tree search; the lesson accepts 4 of 5.

## Taught in

The lesson [few-shot and chain-of-thought](../../../phases/11-llm-engineering/02-few-shot-cot/) builds the escalation pipeline and gives the cost of each technique.
