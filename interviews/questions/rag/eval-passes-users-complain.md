---
id: eval-passes-users-complain
title: Every metric is high and one unit still gets wrong answers
card: rag
kind: design
level: 4
roles: [ai-evaluation-reliability-engineer, applied-ai-engineer, forward-deployed-ai-engineer]
rounds: [system-design, design-review]
tags: [rag-eval, qrels, drift, golden-set, slicing]
minutes: 15
lessons: [phases/19-capstone-projects/68-rag-eval-precision-recall, phases/19-capstone-projects/08-production-rag-chatbot, phases/05-nlp-foundations-to-advanced/23-chunking-strategies-rag]
manuals: []
practice: []
cheatsheet: [llm-evaluation, rag-production]
related: [rag/diagnose-from-the-metric-table, rag/take-home-stratified-eval]
updated: 2026-11-03
---

Your RAG eval reports high recall, high MRR, high faithfulness and high answer relevance, and the weekly drift dashboard is flat. Support still forwards a stream of wrong answers from one business unit. As the staff engineer on the system, what do you conclude, and what do you change in the eval program itself?

## Short answer

Conclude that the eval set does not represent that unit's traffic: all four metrics can be high on queries that nobody asks. Add their real queries to the qrels, slice every metric by query class and document type, and check whether their documents are chunked by a splitter that fits their format. Then change the program: tier the qrels, review them on a schedule so they do not rot, and treat a per-slice drop as a release blocker.

## Full answer

### The row in the table

The eval lesson ends its diagnosis table with this exact pattern: all four metrics high, users still complain, likely cause an unrepresentative eval set, fix by expanding the qrels with real user queries. A dashboard that tracks the same set every week stays flat for the same reason.

### Why averages hide it

A 90 percent average recall can hide one query class that always misses. The lesson's rule is to slice the qrels by class, such as literal, paraphrased and multi-topic, and report each slice. The chunking lesson adds the other axis: a query-type-stratified set, because multi-hop queries reveal different winners than factoid queries.

### The changes to the program

1. **Expand the qrels with that unit's real queries**, labeled by a domain expert with gold ids and answers, as the production capstone does for its golden set of 200 pairs with citations.
2. **Tag every qrel** with query class and document type, and report every metric per slice.
3. **Persist the per-query trace** per run, so that when a complaint arrives you can look up the matching qrel and see whether the eval would have caught it.
4. **Schedule a qrels review.** Gold answers drift as the corpus changes; the lesson schedules a quarterly review.
5. **Lock the chunker in the qrels header**, and check that the splitter in production fits that unit's document format.
6. **Tier the sets**: 20 queries in CI, 200 nightly, 2000 weekly, and make a per-slice drop a release blocker.

### What the dashboard should have shown

The capstone's drift dashboard tracks retrieval quality weekly and alerts on a 5 percent drop. It can only alert on the traffic it contains. Once the unit's queries are in the set, the same alert starts to mean something for them.

## Follow-ups

- **Level 3:** Why can every metric be high while the answers are wrong? Expected: the metrics are computed on the eval set, and that set lacks the queries and documents where the failures happen.
- **Level 4:** What is the first concrete change to the qrels? Expected: add that unit's real queries with expert-labeled gold ids and answers, tagged with query class and document type for slicing.
- **Level 4:** How do you keep the qrels honest over time? Expected: a scheduled review, quarterly in the lesson, because gold answers drift as the corpus changes, plus a check that the chunker in the qrels header is the one in production.
- **Level 4:** Why was the drift dashboard flat while quality fell? Expected: it tracks the same unrepresentative set every week; an alert on that set says nothing about traffic it does not contain.

## Wrong answers

- "The metrics are high, so the complaints are user error." The metrics grade the eval set, not the traffic; the complaints are the missing data.
- "Raise the thresholds." Tighter thresholds on the wrong queries still measure the wrong queries.
- "Replace the eval with a bigger public benchmark." A public set has nothing from that unit; the fix is their real queries, labeled.

## Taught in

The lesson [RAG evaluation](../../../phases/19-capstone-projects/68-rag-eval-precision-recall/) names the unrepresentative set, per-slice reporting, qrels rot and the tiers, the capstone [production RAG](../../../phases/19-capstone-projects/08-production-rag-chatbot/) sets the golden set and the drift alert, and the lesson [chunking strategies](../../../phases/05-nlp-foundations-to-advanced/23-chunking-strategies-rag/) stratifies the queries by type.
