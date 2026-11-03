---
id: query-key-value-lookup
title: Explain query, key and value in one minute
card: transformers
kind: concept
level: 1
roles: [applied-ai-engineer, ai-data-engineer, ai-developer-relations-engineer, inference-engineer]
rounds: [screen, ml-breadth]
tags: [attention, query-key-value, encoder-decoder, self-attention]
minutes: 6
lessons: [phases/05-nlp-foundations-to-advanced/10-attention-mechanism, phases/07-transformers-deep-dive/02-self-attention-from-scratch]
manuals: []
practice: [scaled-dot-product-attention]
cheatsheet: [transformers-attention]
related: []
updated: 2026-11-03
---

A new teammate has read the word "attention" a hundred times and still cannot say what a query, a key or a value is. Explain the three to them in one minute. Then tell me what changed between the 2014 encoder-decoder version and the version inside a transformer.

## Short answer

Attention is a soft lookup. Each token produces a query that asks for information, a key that says what the token holds, and a value that the token hands over when it is picked. The query is scored against every key, the scores go through a softmax, and the output is the weighted sum of the values. In the 2014 version the query was the decoder state and the keys and the values were the same encoder states; a transformer takes all three from one sequence through three learned projections.

## Full answer

### The three projections

For a sequence X of n tokens with d dimensions each:

```text
Q = X @ Wq    (n, dk)   what each token looks for
K = X @ Wk    (n, dk)   what each token contains
V = X @ Wv    (n, dv)   what each token returns when picked
scores = Q @ K.T        (n, n)
```

Row i of the score matrix is one token's view of the whole sequence. The softmax turns the row into weights that sum to one. The output for token i is the weighted sum of all value vectors.

### The database picture

A real database matches a query to one key and returns one value. Attention matches a query to every key with a similarity score and returns a blend of every value. The blend is what lets the model combine information from several positions in one step.

### What the 2014 version had

The encoder-decoder attention of 2014 used the previous decoder state as the query and scored it against every encoder hidden state. The context vector was the weighted average of those same encoder states. In that design the keys and the values were the same thing. Two score functions were common: an additive score that passes the pair through a tanh and a learned vector, and a multiplicative score that takes a dot product. The three-line fix broke the fixed-size bottleneck of the encoder-decoder.

### What a transformer changed

Self-attention queries a sequence against itself, and it separates keys from values with different learned projections. Multi-head attention runs several of these in parallel. The weighted sum of values is the same idea. The score function changes: the additive tanh score and the plain dot product give way to a dot product divided by the square root of the key width.

## Follow-ups

- **Level 1:** What shape does the output have for one token? Expected: the value dimension, because the output is a weighted sum of value vectors.
- **Level 2:** Why give keys and values separate projections? Expected: a token can be matched on one kind of information and return another kind.
- **Level 2:** Why does the plain dot-product score need the query and the key to have the same dimension? Expected: a dot product is only defined for vectors of equal length; the general form inserts a matrix W to remove that constraint.
- **Level 3:** Name the convention trap between the two classic score functions. Expected: one uses the decoder state before the current step and the other uses the state after it; mixing them produces subtly wrong gradients.

## Wrong answers

- "The key and the value must be the same vector." They were in the classic version, but a transformer learns separate projections for them.
- "Attention picks the single best matching token." The softmax gives a weight to every position, and the output blends all of the values.
- "The query comes from the encoder." In encoder-decoder attention the query comes from the decoder and the keys and the values come from the encoder.

## Taught in

The [attention mechanism lesson](../../../phases/05-nlp-foundations-to-advanced/10-attention-mechanism/) builds the classic version and the [self-attention lesson](../../../phases/07-transformers-deep-dive/02-self-attention-from-scratch/) builds the projections.
