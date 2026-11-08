---
id: judge-grades-its-own-work
title: Faithfulness stays high while reviewers find invented facts
card: rag
kind: debug
level: 3
roles: [ai-evaluation-reliability-engineer, applied-ai-engineer]
rounds: [debugging, ml-depth]
tags: [faithfulness, llm-judge, rag-eval, bias]
minutes: 10
lessons: [phases/19-capstone-projects/68-rag-eval-precision-recall, phases/05-nlp-foundations-to-advanced/13-question-answering]
manuals: []
practice: []
cheatsheet: [llm-evaluation]
related: [rag/diagnose-from-the-metric-table, rag/faithfulness-vs-relevance]
updated: 2026-11-03
---

Your faithfulness score comes from a model that reads each claim next to the retrieved context and answers yes or no. The score has sat near the top for a month, yet reviewers keep finding invented facts in sampled answers. The generator and the judge are the same model. What is going on, and what do you change?

## Short answer

A judge from the same family as the generator grades its own output as more faithful than it is, so the number stays high while the samples show the truth. Switch the judge to a different model family or hand-grade a sample, and add a sample-level review, because a per-sentence check can pass while the whole answer misleads.

## Full answer

### How the metric is built

The eval splits the answer into sentence-shaped claims, asks the judge whether each claim is supported by the retrieved context, and reports the fraction that pass. The lesson ships a deterministic stand-in judge based on token overlap so the eval runs offline, and swaps in a model call in production. The question answering lesson describes the production form: entailment between each claim and the context, with no gold answer needed.

### Two blind spots

1. **Judge bias.** A model judges the output of its own family as more faithful than it is. The lesson's rule: use a different model family for the judge than for the generator, or hand-grade a sample.
2. **Micro-checks miss macro-claims.** Each sentence can be supported while the answer as a whole draws a conclusion that the context does not. Add a sample-level qualitative review on top of the automated metric.

### What to change

- Change the judge family, then measure the disagreement between the old judge and the new one on the same fixture. The lesson's exercise does the same between the mock judge and a real model.
- Hand-grade a fixed sample each week and treat it as the calibration set for the automated score.
- Consider graded faithfulness with three values, unsupported, partially supported and fully supported, instead of a yes or no.
- Keep answer relevance next to faithfulness. A grounded answer to the wrong question is strong on one metric and weak on the other.

## Follow-ups

- **Level 3:** How do you size the judge problem before you change anything? Expected: hand-grade a sample of claims and measure the disagreement between the judge and the human labels.
- **Level 3:** Every sentence passes but the answer as a whole misleads. Which check catches that? Expected: a sample-level qualitative review in addition to the per-claim metric.
- **Level 4:** Why can a high faithfulness score sit next to a useless answer? Expected: faithfulness compares the answer with the context and not with the question, so a grounded off-topic answer scores high on faithfulness and low on relevance.
- **Level 4:** The team wants the strongest model available as judge, and it is also the generator. What do you say? Expected: pick the judge for independence first; a strong judge of its own family is still biased, so use another family and keep a human-graded calibration sample.

## Wrong answers

- "The score is high, so the reviewers are wrong." The score is one model's opinion of its own family's output; the sampled answers are the ground truth.
- "Make the judge stricter and the problem goes away." A stricter prompt or threshold does not remove a bias toward the judge's own family; only another family or a human sample does.
- "Replace faithfulness with answer relevance." They measure different things; relevance asks whether the answer addresses the question and says nothing about grounding.

## Taught in

The lesson [RAG evaluation](../../../phases/19-capstone-projects/68-rag-eval-precision-recall/) names judge bias and the macro-claim gap, and the lesson [question answering](../../../phases/05-nlp-foundations-to-advanced/13-question-answering/) describes entailment-based faithfulness in production.
