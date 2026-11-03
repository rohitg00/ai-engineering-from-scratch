---
id: filter-before-search
title: Filter on metadata ahead of the vector search
card: rag
kind: design
level: 2
roles: [applied-ai-engineer, forward-deployed-ai-engineer, ai-data-engineer]
rounds: [system-design, design-review]
tags: [metadata-filtering, access-control, hybrid-search, pre-filter]
minutes: 8
lessons: [phases/11-llm-engineering/07-advanced-rag, phases/19-capstone-projects/08-production-rag-chatbot]
manuals: []
practice: []
cheatsheet: [rag-production]
related: [rag/jurisdiction-leak-in-shared-index, rag/design-rag-over-company-docs]
updated: 2026-11-03
---

A question asks what changed in the security policy last month. Your vector search returns a two-year-old security document because it is semantically close. Design the retrieval step so that this cannot happen, and say what else the same mechanism buys you in a regulated deployment.

## Short answer

Store metadata with each chunk, such as the source, the creation date, the category, the author and the version, and filter on it before the similarity search runs. For this question the filter is the security category and the last 30 days, so the old document is never a candidate. Under regulation the same pre-filter carries role labels and jurisdiction tags, so a user only retrieves chunks they are allowed to see.

## Full answer

### Pre-filter, not post-filter

A filter after the top k comes back can leave nothing: if every slot in the top k went to old documents, the right one never had a chance. A filter applied ahead of the search shrinks the space the similarity search runs over, which the advanced RAG lesson calls critical for performance at scale, and an excluded document cannot fill a slot. Vector stores support this as metadata pre-filtering.

### What to store

| Field | Used for |
|---|---|
| Source document | citations and per-document de-duplication |
| Creation date and version | time windows and stale-document control |
| Category | scope, such as security or billing |
| Author | provenance |
| Role label | who may see the chunk |
| Jurisdiction tag | which regulatory scope the chunk belongs to |

### The regulated pipeline

The production capstone orders the query side as: filter by role and jurisdiction first, then parallel dense and BM25 retrieval, then rank fusion, then the top 20 to the reranker, then the top 5 to the generator. The labels are produced at ingestion, next to the chunk summaries, so nothing downstream has to guess them.

### Prove it

Access control that is not tested is a hope. The capstone runs a pre-release red team with cross-jurisdiction leak probes, and its exercise builds a second corpus slice under another jurisdiction and runs a 20-question cross-jurisdiction probe, scored pass or fail.

## Follow-ups

- **Level 2:** Why filter before the search and not after? Expected: the search space shrinks, which helps at scale, and an excluded document can never take a slot in the top k.
- **Level 2:** Which fields do you store with each chunk? Expected: source, date, category, author and version, plus role and jurisdiction labels in a regulated setting.
- **Level 3:** How do you test that the role filter holds? Expected: a probe set of cross-jurisdiction questions, which the capstone runs as a 20-question check scored pass or fail.
- **Level 3:** Where does the filter sit relative to the reranker and the generator? Expected: before retrieval; the capstone filters, then runs hybrid retrieval, then the reranker gets the top 20 and the generator gets the top 5.

## Wrong answers

- "Put the date into the query text so the embedding reflects it." An embedding does not enforce a date; a semantically close old document still scores high.
- "Filter the results after the top k comes back." If the top k is all old documents the filter leaves nothing, and the right one never had a chance.
- "Tell the model not to use documents from another jurisdiction." Access control belongs in retrieval, before the text reaches the prompt.

## Taught in

The lesson [advanced RAG](../../../phases/11-llm-engineering/07-advanced-rag/) explains metadata pre-filtering, and the capstone [production RAG](../../../phases/19-capstone-projects/08-production-rag-chatbot/) applies the access filters ahead of retrieval and probes them in the red team.
