---
id: faithfulness-vs-relevance
title: Faithfulness and answer relevance grade different things
card: rag
kind: concept
level: 2
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer, ai-developer-relations-engineer]
rounds: [screen, ml-breadth]
tags: [faithfulness, answer-relevance, rag-eval, llm-judge]
minutes: 7
lessons: [phases/19-capstone-projects/68-rag-eval-precision-recall, phases/05-nlp-foundations-to-advanced/13-question-answering]
manuals: []
practice: []
cheatsheet: [llm-evaluation]
related: [rag/judge-grades-its-own-work, rag/recall-at-k-first]
updated: 2026-11-03
---

Two answer-grade metrics sit in your RAG eval report: faithfulness and answer relevance. A teammate says they measure the same thing and wants to drop one. Explain what each one grades, and give one answer that scores high on one and low on the other.

## Short answer

Faithfulness asks whether each claim in the answer is supported by the retrieved context. Answer relevance asks whether the answer addresses the question. A grounded summary of the retrieved chunks that never gets to the question scores high on faithfulness and low on relevance, and a short direct answer from the model's own memory scores high on relevance and low on faithfulness.

## Full answer

### How each one is computed

| Metric | Input to the judge | Output |
|---|---|---|
| Faithfulness | one claim from the answer, plus the retrieved context | yes or no, aggregated to the fraction of claims that pass |
| Answer relevance | the question, plus the answer | does the answer address the question |

The eval splits the answer into sentence-shaped claims first. Faithfulness is also called groundedness, support or attribution. In its production form, the question answering lesson describes it as entailment between claim and context, and relevance as generating hypothetical questions from the answer and comparing them with the real one.

### Why both stay

Each one catches a failure the other cannot see:

- Faithfulness catches an invented fact, because the fact has no support in the context.
- Relevance catches an answer that wandered, because the judge never sees the context and only asks whether the question was answered.

The diagnosis table in the eval lesson uses the pair. High MRR with low faithfulness points at the generation prompt. High faithfulness with low relevance points at the query rewriter or the prompt.

### No gold answer needed

Both are judged against the context and the question, not against a reference answer. That lets you score live traffic without labels, next to context precision and context recall for the retrieval side.

### The offline stand-in

The lesson ships a deterministic judge based on token overlap above a threshold, so the eval runs with no network call. It cannot read meaning, so production swaps it for a model judge from a different family than the generator.

## Follow-ups

- **Level 2:** Which of the two catches a hallucination? Expected: faithfulness, because an invented fact has no support in the retrieved context.
- **Level 2:** Low relevance with high faithfulness points at which stage? Expected: the query rewriter or the generation prompt; the context was about something else, or the answer drifted from the question.
- **Level 3:** Why does neither metric need a reference answer? Expected: both are judged against the context and the question, which is what makes them usable on live traffic.
- **Level 3:** What is the limit of the lesson's offline judge? Expected: it counts token overlap above a threshold, so it cannot read meaning; production uses a model judge, from a different family than the generator.

## Wrong answers

- "They are the same, a faithful answer is relevant." A faithful answer can summarize the context and ignore the question.
- "Relevance is enough when retrieval is good." Relevance never sees the context, so an answer from the model's own memory can be relevant and ungrounded.
- "Faithfulness needs a gold answer." It is judged against the retrieved context, which is why it works on live traffic.

## Taught in

The lesson [RAG evaluation](../../../phases/19-capstone-projects/68-rag-eval-precision-recall/) defines both metrics and the stand-in judge, and the lesson [question answering](../../../phases/05-nlp-foundations-to-advanced/13-question-answering/) gives the production forms.
