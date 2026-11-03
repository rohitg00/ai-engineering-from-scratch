---
id: jurisdiction-leak-in-shared-index
title: The other jurisdiction's clause reached the answer
card: rag
kind: design
level: 4
roles: [forward-deployed-ai-engineer, applied-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [system-design, design-review]
tags: [access-control, jurisdiction, red-team, pre-filter]
minutes: 15
lessons: [phases/19-capstone-projects/08-production-rag-chatbot, phases/11-llm-engineering/07-advanced-rag]
manuals: []
practice: []
cheatsheet: [rag-production]
related: [rag/filter-before-search, rag/design-rag-over-company-docs]
updated: 2026-11-03
---

A regulated-domain assistant serves analysts in two jurisdictions from one index. In a red-team probe, a question asked under one jurisdiction returned a contract clause that belongs to the other. The reranker and the generator behave as designed. Where is the leak, how do you close it, and how do you prove that it stays closed?

## Short answer

The leak is in retrieval: the jurisdiction tag was not applied as a pre-filter before the similarity search, so a semantically close chunk from the other jurisdiction entered the candidate pool, and nothing downstream is built to remove it. Close it by tagging every chunk with role and jurisdiction at ingestion and filtering on both before hybrid retrieval runs. Prove it with a cross-jurisdiction probe set in the red-team suite, scored pass or fail with a severity, and run before every release.

## Full answer

### Why downstream stages cannot save you

The reranker orders the candidates it receives by relevance, and the leaked clause is relevant. The generator cites what it is given. The output guard scrubs personal data and blocks forbidden topics; it does not know which jurisdiction a clause belongs to. Access control has to happen before the text reaches the prompt, and the only stage that sees the whole corpus is retrieval.

### The capstone order

Filter by role and jurisdiction first. Then run dense and BM25 retrieval in parallel, fuse by rank, send the top 20 to the reranker, the top 5 to the generator, then the guards, then cite and return. The tags come from ingestion, where each chunk receives a summary, a role label and a jurisdiction tag.

### Closing it

1. Tag at ingestion, and make ingestion refuse a chunk that has no tag.
2. Filter before retrieval, not on the top k after it; a post-filter can leave an empty result and still lets an untagged chunk through.
3. Treat the caller's jurisdiction as a request parameter, never as a hint in the prompt.

### Proving it

The capstone runs a pre-release red team of 50 adversarial prompts that include cross-jurisdiction leaks, scored pass or fail with a severity. Its exercise adds a second corpus slice under another jurisdiction and runs a 20-question cross-jurisdiction probe. Put that probe in the release gate for every change to ingestion or retrieval, and carry the leak count on the drift dashboard as a hard zero.

## Follow-ups

- **Level 3:** Why can the reranker not catch the leaked clause? Expected: it only orders the candidates it receives, and a clause from the wrong jurisdiction is still relevant to the question.
- **Level 3:** Why is the output guard not the fix? Expected: it scrubs personal data and blocks forbidden topics; it cannot tell which jurisdiction a clause belongs to.
- **Level 4:** The tags exist and the leak persists. What do you check? Expected: whether the filter runs before retrieval or on the top k after it, and whether ingestion lets an untagged chunk in.
- **Level 4:** How do you keep the proof current? Expected: run the probe set in the red team on every change to ingestion or retrieval, and show the leak count on the drift dashboard with a zero threshold.

## Wrong answers

- "Add a sentence to the system prompt about the user's jurisdiction." The model cannot verify which jurisdiction a chunk belongs to; access control belongs in retrieval.
- "Separate indexes solve it, no tags needed." Role filtering still needs labels, shared documents get duplicated, and the probe is still needed to prove the split holds.
- "The red team passed once, so it is closed." One pass proves one build; the probe runs on every ingestion or retrieval change.

## Taught in

The capstone [production RAG](../../../phases/19-capstone-projects/08-production-rag-chatbot/) applies its access filter ahead of retrieval and probes it in its red team, and the lesson [advanced RAG](../../../phases/11-llm-engineering/07-advanced-rag/) explains metadata pre-filtering.
