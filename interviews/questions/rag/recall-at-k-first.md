---
id: recall-at-k-first
title: The first metric to read after a wrong answer
card: rag
kind: concept
level: 1
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer, ai-data-engineer]
rounds: [screen, ml-breadth]
tags: [rag-eval, recall, precision, qrels]
minutes: 6
lessons: [phases/19-capstone-projects/68-rag-eval-precision-recall, phases/05-nlp-foundations-to-advanced/13-question-answering]
manuals: []
practice: []
cheatsheet: [llm-evaluation, rag-production]
related: [rag/diagnose-from-the-metric-table, rag/rag-or-fine-tune]
updated: 2026-11-03
---

A user reports that the document assistant gave a wrong answer. The pipeline has a chunker, a retriever, a reranker and a generator. You get one metric to look at before anything else. Which one, and why that one?

## Short answer

Recall at k on the retrieval stage. If the gold chunk is not in the top k, no reranker can bring it back and the generator usually lacks the evidence for the right answer, unless another chunk happens to hold it, so the later metrics are hard to read. Recall comes first in the order, but it is not a gate: when recall holds, or when another retrieved chunk holds the evidence, move on to the rank position and then to the generated text, because a failure there stays hidden otherwise.

## Full answer

### The two retrieval metrics

Precision at k asks what share of the top k is gold. If the gold set has three documents and the top 3 returns two of them plus one wrong one, precision at 3 is 2 / 3. Recall at k asks what share of the gold set is in the top k. If the top 5 holds all three gold documents, recall at 5 is 1.0.

Production teams quote recall. The generator can ignore an extra chunk with ease. It cannot invent an answer from a chunk it never saw.

### The order of the checks

| Symptom | Likely cause | What to fix |
|---|---|---|
| Low recall and low precision | the chunker cut the answer or the retriever cannot find it | chunk boundaries or the retrieval modality |
| Decent recall, low MRR | the right chunk is in the top k but not at position 1 | the reranker |
| High MRR, low faithfulness | the generator invents content despite the right context | the generation prompt, cite or refuse |
| High faithfulness, low relevance | the answer is grounded but off topic | the query rewriter or the prompt |
| All four high, users still complain | the eval set does not represent real queries | add real user queries to the qrels |

### Keep the eval cheap

Tier the qrels: a smoke set of 20 queries that runs in CI, a regression set of 200 that runs nightly, and a deep set of 2000 that runs weekly. Treat a recall regression like a failing test.

## Follow-ups

- **Level 1:** What does precision at k add once recall is fine? Expected: it shows how much of the returned list is noise, which matters when a wrong chunk poisons the answer or wastes tokens.
- **Level 2:** Recall at 5 is fine but the gold chunk sits at rank 4 or 5. Which metric shows that, and which stage do you fix? Expected: MRR, and the reranker.
- **Level 3:** Recall averages 90 percent and one team still complains every day. What is hidden? Expected: one query class that always misses; slice the qrels by class, such as literal, paraphrased and multi-topic, and report each slice.
- **Level 3:** How do you keep the eval fast enough to run on every change? Expected: tiers, with a smoke set of 20 queries in CI, 200 nightly and 2000 weekly.

## Wrong answers

- "Read the answer and judge it." The answer alone cannot tell which of the four stages failed.
- "Precision at k, because the noise caused the wrong answer." Precision matters once the right chunk is present; a missing chunk is the first thing to rule out.
- "Faithfulness, because the model hallucinated." A faithful answer to the wrong chunks is still wrong; faithfulness only grades the generator against what it saw.

## Taught in

The lesson [RAG evaluation](../../../phases/19-capstone-projects/68-rag-eval-precision-recall/) defines the metrics and the diagnosis table, and the lesson [question answering](../../../phases/05-nlp-foundations-to-advanced/13-question-answering/) says to measure the retriever before the reader.
