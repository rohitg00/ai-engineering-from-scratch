---
id: refuse-when-confidence-is-low
title: Let the assistant say it does not know
card: rag
kind: design
level: 3
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer, forward-deployed-ai-engineer]
rounds: [system-design, design-review]
tags: [refusal, hallucination, citations, threshold]
minutes: 10
lessons: [phases/19-capstone-projects/69-end-to-end-rag-system, phases/05-nlp-foundations-to-advanced/13-question-answering, phases/19-capstone-projects/08-production-rag-chatbot, phases/19-capstone-projects/66-reranker-cross-encoder]
manuals: []
practice: []
cheatsheet: [rag-production]
related: [rag/design-rag-over-company-docs, rag/faithfulness-vs-relevance]
updated: 2026-11-03
---

Your document assistant answers every question, including the ones the corpus does not cover, and the invented answers are the ones users remember. Design the path that lets the system say it does not know, and say how you measure that the path works.

## Short answer

Log the reranker's rank-1 score for every query and refuse when it falls below a corpus-specific threshold, instead of handing weak chunks to the generator. Tell the generator to answer only from the snippets, to cite every claim and to say it does not know when the snippets do not answer. Measure refusal calibration: on questions whose answer is not in the store, count how often the system refuses, and track the false confidence rate.

## Full answer

### Gate 1: before generation

The reranker lesson logs the rank-1 cross-encoder score. A query whose top score sits below a corpus-specific threshold is an out-of-domain hit, and the end-to-end lesson refuses on it: the generator returns the refusal text with no citation. The production capstone calls this an unsure mode and measures the drop in false confidence. The question answering lesson starts simpler, with a threshold on the top retrieval similarity, and tunes it on a held-out set.

### Gate 2: inside generation

The prompt tells the model to use only the snippets, to cite every claim with its anchor, and to say it does not know when the snippets do not answer. The question answering lesson measured that the explicit grounding and refusal instruction cuts hallucination by 40 to 60 percent against a naive prompt.

### Gate 3: after generation

Parse the answer and check each claim against the passage that its anchor cites. A claim without an anchor, or with an anchor whose passage does not state the claim, is dropped or sent back for a re-ask. An answer that slipped past the score gate then cannot ship a claim that its cited passage does not support.

### How to measure it

- **Refusal calibration.** On a set of questions with no answer in the store, the share that the system refuses.
- **False confidence rate.** The share of those questions that got an answer anyway.
- **Wrong refusal rate.** On in-corpus questions, the share refused. A threshold that is too high fails here.

Move the threshold on the held-out set, never on production anecdotes, and re-tune it when the embedder, the reranker or the corpus changes.

## Follow-ups

- **Level 3:** Where does the threshold come from? Expected: the distribution of rank-1 scores on a held-out set with known in-corpus and out-of-corpus questions; it is specific to the corpus.
- **Level 3:** What does the generator prompt need beyond "use only the context"? Expected: cite each claim with its anchor and say it does not know when the snippets do not answer; the explicit instruction cut hallucination by 40 to 60 percent in the question answering lesson.
- **Level 4:** Too many refusals are also a failure. How do you balance it? Expected: track the false confidence rate on out-of-corpus questions next to the wrong refusal rate on in-corpus questions, and move the threshold on the held-out set.
- **Level 4:** How does the citation post-filter work with the refusal gate? Expected: each claim is checked against the passage its anchor cites, and a claim with no anchor or with a passage that does not state it is dropped or re-asked, so a weak answer that passed the score gate cannot ship an unsupported claim.

## Wrong answers

- "Tell the model to be careful." An instruction cannot see the retrieval scores; the first gate belongs before generation.
- "Refuse when retrieval returns fewer than k chunks." A count is not confidence; weak chunks still fill k slots.
- "Set the threshold once from the fixture." It is corpus specific and moves when the embedder, the reranker or the corpus changes.

## Taught in

The lesson [end-to-end RAG](../../../phases/19-capstone-projects/69-end-to-end-rag-system/) builds the refuse path and the cited generator, the lesson [question answering](../../../phases/05-nlp-foundations-to-advanced/13-question-answering/) defines refusal calibration, the capstone [production RAG](../../../phases/19-capstone-projects/08-production-rag-chatbot/) adds the unsure mode, and the lesson [cross-encoder](../../../phases/19-capstone-projects/66-reranker-cross-encoder/) logs the rank-1 score.
