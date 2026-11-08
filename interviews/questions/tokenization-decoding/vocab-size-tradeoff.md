---
id: vocab-size-tradeoff
title: Put numbers on growing the vocabulary to 128K
card: tokenization-decoding
kind: estimate
level: 2
roles: [applied-ai-engineer, ai-data-engineer, inference-engineer]
rounds: [screen, system-design]
tags: [vocabulary-size, embedding-matrix, compression, inference-cost, estimation]
minutes: 8
lessons: [phases/10-llms-from-scratch/01-tokenizers, phases/05-nlp-foundations-to-advanced/19-subword-tokenization]
manuals: []
practice: []
cheatsheet: [tokenization]
related: [tokenization-decoding/why-subword-tokens]
updated: 2026-11-03
---

A team wants to grow the vocabulary of a new model from 32K to 128K tokens. The embeddings have 4,096 dimensions. Put numbers on what the change costs and on what it buys.

## Short answer

The embedding matrix goes from 32,000 by 4,096, about 131 million parameters, to 128,000 by 4,096, about 524 million, so about 400M more parameters from the tokenizer alone, and an untied output head costs the same again. In return the text compresses: an English paragraph of about 100 tokens at 32K takes about 70 tokens at 128K. Generating that same paragraph then needs about 30 percent fewer forward passes, and non-English scripts gain the most. The lesson's rule of thumb is 32k under 1B parameters, 50 to 100k from 1 to 10B, and 200k and above for multilingual or frontier models.

## Full answer

### The cost side

```text
32,000  x 4,096 = about 131M parameters
128,000 x 4,096 = about 524M parameters
difference      = about 400M
```

Each row is an embedding the model has to learn, and rare rows receive few gradient updates. A small model with a huge vocabulary spends a large share of its parameters in a lookup table.

### The benefit side

| Vocabulary | Tokens per English word |
|---|---|
| 30,522 | about 1.4 |
| 50,257 | about 1.3 |
| 100,256 | about 1.2 |
| 128,256 | about 1.1 |
| 200,019 | about 1.0 |

Fewer tokens per word means shorter sequences, so each answer needs fewer forward passes and each context window holds more text. For a model that serves millions of requests, output of that kind needs about 30 percent fewer forward passes.

### Who gains the most

English already compresses well at 32K. Scripts that an English-heavy vocabulary splits into bytes gain far more, which is why one model family quadrupled its vocabulary from 32K to 128K.

### The decision

Vocabulary size scales with the model and the language mix. Under 1B parameters, the embedding would dominate the model, so stay near 32k. Between 1 and 10B, 50 to 100k. Multilingual at any scale pushes toward 200k and beyond. Validate the choice with tokens per word on a held-out set, the unknown rate, the compression ratio and a byte-exact round trip.

## Follow-ups

- **Level 2:** Why do fewer tokens per word make inference faster? Expected: generation is one forward pass per token, so fewer tokens for the same text means fewer passes.
- **Level 3:** What does a 128K vocabulary do to the output side of the model? Expected: the head has one row per token, so it grows with the embedding, and an untied head doubles the extra parameters.
- **Level 3:** Why did the model family in the lesson move from 32K to 128K? Expected: fairer compression across languages; the English-heavy vocabulary gave other scripts a context window that was effectively half the size.
- **Level 4:** How do you validate a vocabulary size before training? Expected: tokens per word per language on held-out text, the unknown rate, the compression ratio against a reference encoder, and a byte-exact round trip.

## Wrong answers

- "A bigger vocabulary is always better." Under 1B parameters the extra rows dominate the model and rare rows are undertrained.
- "The embedding is a rounding error next to the model." At 128K by 4,096 it is about 524M parameters.
- "Vocabulary size does not affect the cost of a request." Tokens per word set the sequence length, and the sequence length sets the forward passes and the context budget.

## Taught in

The [tokenizers lesson](../../../phases/10-llms-from-scratch/01-tokenizers/) does the embedding arithmetic and gives the fertility table, and the [subword lesson](../../../phases/05-nlp-foundations-to-advanced/19-subword-tokenization/) gives the size heuristic and the validation plan.
