---
id: rag-or-fine-tune
title: Retrieval or fine-tuning for the policy wiki
card: rag
kind: concept
level: 1
roles: [applied-ai-engineer, forward-deployed-ai-engineer, ai-developer-relations-engineer]
rounds: [screen, ml-breadth]
tags: [rag, fine-tuning, freshness, auditability]
minutes: 6
lessons: [phases/11-llm-engineering/06-rag]
manuals: []
practice: []
cheatsheet: [rag]
related: [rag/recall-at-k-first]
updated: 2026-11-03
---

A product team wants an assistant that answers questions about the internal policy wiki. One engineer proposes to tune the model on the wiki pages. Another proposes to search the pages at question time and paste the matches into the prompt. Which do you pick, and in which case would you still tune the model?

## Short answer

Pick retrieval for knowledge. The model never changes, the document store updates in minutes, and you can show the passages behind each answer. Tuning fits when you need a style, a tone or a reasoning pattern that a prompt cannot reach, not when you need facts.

## Full answer

### Why retrieval wins on facts

The lesson lines the two up on five concerns:

| Concern | Tuned model | Retrieval |
|---|---|---|
| Cost | a training run costs from $1,000 to more than $100,000 | a query costs $0.01 to $0.10 for the embedding and the model call |
| Freshness | stale until the next training run | re-index the changed page and the next query sees it |
| Audit | no way to trace a fact to a page | the retrieved passages are visible and can be returned |
| Grounding | the model still invents facts freely | the prompt tells the model to answer only from the passages |
| Privacy | the pages are baked into the weights | the pages stay in your own store |

Tuning changes the weights for good. Retrieval changes the context for one request. For facts, a temporary context is what you want.

### The one case for tuning

When the goal is how the model writes or reasons, and prompting does not get there, tuning is the right tool. A fixed voice, a house format or a reasoning habit lives in the weights better than in a long instruction.

### The shape of the system

Retrieval runs in two phases. The index phase chunks each page, embeds each chunk and stores the vectors with the text. The query phase embeds the question, finds the top k chunks, builds a prompt from them and calls the model. The lesson budgets k at 5 to 10 chunks and 2,500 to 5,000 tokens of retrieved text per query.

## Follow-ups

- **Level 1:** A policy page changes. What happens in each approach? Expected: with retrieval you re-index that page and the next answer uses the new text; with a tuned model the old fact stays until you train again.
- **Level 2:** A legal reviewer asks which page an answer came from. Which approach can show it? Expected: retrieval, because the passages that went into the prompt are known and can be returned with the answer.
- **Level 2:** Why is the privacy story different? Expected: with retrieval the pages stay in your store and only the matched chunks go to the model for one call; with tuning the content is inside the weights of the model you deploy.
- **Level 3:** The answer is wrong even though the right passage is in the store. Which stage do you check first? Expected: retrieval, with recall at k, because the model cannot use a passage that the search did not return.

## Wrong answers

- "Tune the model, because then it knows the documents." The weights hold a copy that goes stale, and nothing in the output says which page a fact came from.
- "Retrieval is always better." A fixed style, a tone or a reasoning pattern is learned better by tuning than by a prompt.
- "Skip the search and put the whole wiki in the prompt." The lesson budgets 2,500 to 5,000 tokens of retrieved text per query; a whole wiki does not fit, and unrelated text dilutes the prompt.

## Taught in

The lesson [RAG](../../../phases/11-llm-engineering/06-rag/) compares the two approaches and builds the index and query phases.
