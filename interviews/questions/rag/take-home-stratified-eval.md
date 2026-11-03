---
id: take-home-stratified-eval
title: Build the eval that picks a retrieval configuration
card: rag
kind: take-home
level: 3
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer, ai-data-engineer]
rounds: [take-home]
tags: [rag-eval, qrels, recall, stratified, take-home]
minutes: 60
lessons: [phases/05-nlp-foundations-to-advanced/23-chunking-strategies-rag, phases/19-capstone-projects/68-rag-eval-precision-recall, phases/19-capstone-projects/64-chunking-strategies-advanced]
manuals: []
practice: []
cheatsheet: [llm-evaluation, rag]
related: [rag/chunk-size-by-query-type, rag/recall-at-k-first]
updated: 2026-11-03
---

Take-home. You receive a corpus of a few hundred internal documents and a retrieval pipeline with two chunkers and two retrievers behind flags. Build the evaluation that tells the team which configuration to ship, and write up what the numbers mean. You have one evening.

## Short answer

Build a labeled query set first, stratified by query type, with gold document ids and gold answer text for each query. Run every configuration against the same set and report recall at 5 for each slice, plus MRR, and read the spread between configurations. Lock the chunker named in the labels, because a change of chunker after labeling moves the gold ids.

## Full answer

### The deliverable

1. **A qrels file.** One record per query with the query text, the gold document ids, a graded relevance map and the gold answer substring. Label at document level, not at chunk level, so the labels survive a chunker change.
2. **A stratified set.** The chunking lesson uses a 50-query set split across factoid, analytical and multi-hop questions. Multi-hop queries reveal different winners than factoid queries, and one average hides the losing class.
3. **The run matrix.** Two chunkers times two retrievers, every cell against the same qrels, same k values.
4. **The metrics.** Recall at 5 as the primary number, precision at k beside it, MRR for the position of the first hit, nDCG if the labels are graded.
5. **The report.** One table with one row per configuration and one column per slice, then a recommendation and the reason, then what you would measure next.

### What to expect

The chunking comparison lesson shows the pattern: the structural header splitter wins on markdown, semantic clustering wins on plain prose, and recursive splitting holds its own on a mixed corpus. The hybrid retriever beats the lexical baseline on recall. Your corpus decides which of these holds.

### Guards that graders look for

- The chunker strategy is recorded in the qrels header, and the gold ids were produced against that strategy.
- Any training pairs for a reranker are disjoint from the eval queries.
- The per-query results are persisted, not only the averages.
- The write-up names what this eval cannot tell: answer quality, which needs faithfulness and relevance judged by a model from another family or by hand.

## Follow-ups

- **Level 3:** Why split the queries by type? Expected: factoid and multi-hop queries reveal different winners, and one average hides the class that loses.
- **Level 3:** The labels were produced with chunker A. Can you reuse them for chunker B? Expected: only if the labels are at document or span level; chunk ids change with the boundaries, so record the chunker in the qrels and relabel otherwise.
- **Level 4:** How do you justify the query count in the write-up? Expected: a 50-query stratified set for the first decision, then tiers of 20 queries in CI, 200 nightly and 2000 weekly, with a note on what each tier can and cannot detect.
- **Level 4:** What do you refuse to conclude after one evening? Expected: anything about answer quality, because the eval grades retrieval; faithfulness and relevance need a judge, and a judge from the generator's own family is biased.

## Wrong answers

- "I wrote ten questions myself and ran each configuration." Ten questions of one type cannot separate four configurations or expose a class that always misses.
- "Here is the average recall for each configuration." One average hides per-slice winners and the class that fails.
- "I changed the chunker and reused the labels." The gold ids no longer line up with the chunks; the chunker belongs in the qrels header.

## Taught in

The lesson [chunking strategies](../../../phases/05-nlp-foundations-to-advanced/23-chunking-strategies-rag/) sets the 50-query stratified set, the lesson [RAG evaluation](../../../phases/19-capstone-projects/68-rag-eval-precision-recall/) defines the qrels and the tiers, and the lesson [chunking comparison](../../../phases/19-capstone-projects/64-chunking-strategies-advanced/) shows which splitter wins on which corpus.
