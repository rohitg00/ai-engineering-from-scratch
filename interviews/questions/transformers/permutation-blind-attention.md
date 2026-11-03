---
id: permutation-blind-attention
title: Shuffle the words and attention does not notice
card: transformers
kind: concept
level: 1
roles: [applied-ai-engineer, inference-engineer, ai-data-engineer]
rounds: [screen, ml-depth]
tags: [positional-encoding, permutation, sinusoidal, rope, alibi]
minutes: 6
lessons: [phases/07-transformers-deep-dive/04-positional-encoding, phases/19-capstone-projects/32-token-positional-embeddings]
manuals: []
practice: [sinusoidal-positional-encoding]
cheatsheet: [positional-encoding]
related: []
updated: 2026-11-03
---

Take a sentence and shuffle its words. Feed both versions through a self-attention layer that has no positional signal. How do the two outputs relate, and what are the three families of fixes you would name?

## Short answer

The output rows come back shuffled in the same way and nothing else changes, because attention only computes pairwise similarities between tokens. Order carries meaning in language and code, so the model needs a second signal. The three fixes are a position vector added to the embedding, a learned table or a fixed sinusoid, a rotation of the queries and keys by an angle that grows with position, and a distance penalty added to the scores.

## Full answer

### Why the layer is blind

The score matrix is `softmax(Q K^T / sqrt(d)) V`, built from dot products between pairs of tokens. Permute the rows of X and every dot product keeps its value; only its position in the matrix moves. The layer is permutation-equivariant by construction.

### Fix one: add a position vector to the input

A learned table has one row per position, so it adds `max_context_length` times D parameters and has no row for a position past the trained length. A fixed sinusoid uses the formula

```text
angle = p / (10000 ** (2 * k / D))
emb[p, 2k]     = sin(angle)
emb[p, 2k + 1] = cos(angle)
```

with no parameters. The wavelength changes geometrically across dimensions. Low dimensions have the largest angle per position and the shortest wavelength, so they encode fine position; high dimensions have the longest wavelength and encode coarse position. The vector at position p plus k is a linear function of the vector at p, which gives attention an easy way to learn relative offsets. The position vector is summed with the token vector, not concatenated, so D stays constant and the model decides per feature how much position matters.

### Fix two: rotate the queries and keys

Rotary position embedding rotates each pair of coordinates in Q and K by `pos * theta_i`, with `theta_i = base ** (-2i / d_head)` and a default base of 10000. The dot product of a rotated query and a rotated key then depends only on their distance. This is the dominant choice in 2026.

### Fix three: bias the scores

Linear-bias attention adds `-m_h * |i - j|` to the score of query i and key j, with a slope per head. No table, no rotation, and strong extrapolation to longer inputs.

### Where each one lives

The first family changes the input to the first layer. The other two act inside attention, on the projections or the scores, so they follow the same shape contract as the embedding stage without touching the embedding.

## Follow-ups

- **Level 1:** Why add the two vectors instead of concatenating them? Expected: the sum keeps D constant through the network and lets the model weigh token and position per feature.
- **Level 2:** What does a learned position table cost that a sinusoid does not? Expected: `max_context_length` times D parameters, and it cannot be indexed past the trained length.
- **Level 2:** Why do the high dimensions of the sinusoid encode coarse position? Expected: their wavelength is longest, so they change slowly across positions.
- **Level 3:** Where in the block does the rotation apply? Expected: to Q and K inside attention, after the projection and before the score matmul, never to V.

## Wrong answers

- "The softmax makes attention order-aware." The softmax normalizes a row of similarities; it has no idea which column is first.
- "Add the position as one extra number on the embedding." One scalar cannot give the dot products a usable signal; the schemes spread position across many dimensions or into the scores.
- "Position only matters for long sequences." A two-word sentence already changes meaning when its words swap.

## Taught in

The [positional encoding lesson](../../../phases/07-transformers-deep-dive/04-positional-encoding/) compares the three families and the [embedding capstone](../../../phases/19-capstone-projects/32-token-positional-embeddings/) builds the learned and sinusoidal tables.
