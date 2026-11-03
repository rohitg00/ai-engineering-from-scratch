---
id: overlap-measure-first
title: Settle a chunk overlap argument with one ablation
card: rag
kind: tradeoff
level: 2
roles: [applied-ai-engineer, ai-data-engineer]
rounds: [design-review, ml-depth]
tags: [chunking, overlap, index-cost, ablation]
minutes: 8
lessons: [phases/05-nlp-foundations-to-advanced/23-chunking-strategies-rag, phases/11-llm-engineering/06-rag]
manuals: []
practice: []
cheatsheet: [rag]
related: [rag/chunk-size-by-query-type]
updated: 2026-11-03
---

Your chunker keeps a 100-token overlap between neighbor chunks. After the last corpus refresh the index size and the embedding bill both went up, and a teammate says the overlap must stay because it protects sentences that a boundary would cut in half. How do you settle it?

## Short answer

Settle it with an ablation, not an opinion. Run the same recall at 5 eval with the overlap at zero and at the current value on a stratified query set, and keep the overlap only if the number moves. The recent studies found that overlap often adds no measurable benefit, while it adds index cost in proportion to its size.

## Full answer

### Where overlap came from

The fixed-window baseline cuts every N tokens with no regard for sentences. The RAG lesson shows the classic layout: 512-token chunks with a 50-token overlap, so chunk 1 holds tokens 0 to 511 and chunk 2 holds tokens 462 to 973. The repeated tail makes sure a sentence cut at an unlucky point appears whole somewhere.

### Why it matters less now

A recursive splitter tries the paragraph break first, then the line break, then the sentence end, then the space. Its boundaries fall at natural breaks, so the problem that overlap solved mostly disappears. The chunking lesson lists overlap under cargo cult: the 2026 studies found zero measurable benefit in the measured case, and every overlapped token is embedded and stored twice.

### The test

1. Keep the chunker, the embedder and the query set fixed.
2. Run recursive splitting at 512 tokens with overlap zero and with the current overlap.
3. Compare recall at 5 per query slice, and compare chunk counts.
4. Keep the overlap only where a slice shows a real gain, and record the ablation next to the setting.

The chunker skill in the lesson sets overlap to zero by default and refuses an overlap above 20 percent without an ablation that shows it helps.

## Follow-ups

- **Level 2:** Why did the fixed-window splitter need overlap? Expected: it cuts at a fixed count whatever the text, so a boundary can split a sentence; the repeated tail puts that sentence whole into the next chunk.
- **Level 2:** What does a recursive splitter do instead? Expected: it splits on the paragraph, the line and the sentence separators in turn, so boundaries land on natural breaks.
- **Level 3:** What rule does the chunker skill apply to overlap? Expected: default zero, and refuse any overlap above 20 percent without an ablation.
- **Level 3:** The ablation shows a gain on one document type only. What do you ship? Expected: overlap for that type alone, with the ablation recorded, and a re-run when the corpus or the embedder changes.

## Wrong answers

- "Overlap is free, embeddings are cheap." Every overlapped token is embedded and stored twice, so the index cost grows in proportion to the overlap.
- "A blog post says 20 percent overlap." The studies found no measurable benefit in the measured case; the answer depends on your corpus, so measure it there.
- "Remove it everywhere, no test needed." The ablation is cheap and the result is corpus dependent; a slice with real boundary losses would show up in it.

## Taught in

The lesson [chunking strategies](../../../phases/05-nlp-foundations-to-advanced/23-chunking-strategies-rag/) reports the overlap studies and sets the skill rule, and the lesson [RAG](../../../phases/11-llm-engineering/06-rag/) shows the fixed-window layout that overlap was built for.
