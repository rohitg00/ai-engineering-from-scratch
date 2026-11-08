---
id: pick-encoder-or-decoder
title: Encoder, decoder or both for three products
card: transformers
kind: tradeoff
level: 2
roles: [applied-ai-engineer, forward-deployed-ai-engineer, ai-data-engineer, inference-engineer]
rounds: [system-design, ml-breadth]
tags: [encoder-only, decoder-only, encoder-decoder, cross-attention, pretraining-loss]
minutes: 8
lessons: [phases/07-transformers-deep-dive/05-full-transformer, phases/07-transformers-deep-dive/07-gpt-causal-language-modeling]
manuals: []
practice: []
cheatsheet: [bert-gpt-t5]
related: [transformers/causal-mask-minus-infinity]
updated: 2026-11-03
---

Three products land on your desk: a search ranking model over documents, a coding assistant that writes code, and a speech-to-text system. Which transformer shape do you pick for each, and what does the pretraining loss have to do with the choice?

## Short answer

Encoder-only for ranking and embeddings, decoder-only for generation, and encoder-decoder when the input is a clear source sequence such as audio to transcribe. An encoder reads both sides of every position and trains on masked prediction, which gives strong representations and no way to generate. A decoder trains on next-token prediction behind a causal mask, so it can generate, and it scales cleanest, which is why it won language. The loss decides whether the model can produce text at all.

## Full answer

### The three skeletons

| Need | Shape | Why |
|---|---|---|
| Classification, embeddings, question answering over text | Encoder-only | Bidirectional attention sees the whole input at once |
| Text generation, chat, code, reasoning | Decoder-only | Causal mask plus next-token loss; one pass of attention and FFN per layer |
| Structured input to structured output, translation, speech recognition | Encoder-decoder | The encoder owns the source; the decoder generates and reads it through cross-attention |

### The one line that separates them

A decoder predicts each token's probability given the tokens before it. An encoder predicts a masked token given the unmasked ones. Same block, same attention, different mask and different target. Only the first loss produces a model that can continue a sequence.

### Cross-attention

A decoder block in an encoder-decoder model has three sublayers: masked self-attention, cross-attention and the FFN. In cross-attention the queries come from the decoder and the keys and values come from the encoder output. It is the only place where information flows from the source to the output. A pure decoder drops it.

### Why decoder-only won language

It handles comprehension and generation with one architecture, it scales cleanly, and in-context learning let one model follow examples without a new head per task. Encoder-decoder is still the best fit when the input has a strong source identity: a waveform, a sentence in another language, a table to summarize.

### The three answers

1. Ranking: an encoder, or an embedding model built on one, because you need a representation of the whole document and no generation.
2. Coding assistant: a decoder, because the product is generation and the causal loss is what makes generation possible.
3. Speech-to-text: an encoder-decoder, because the audio is a source sequence of its own kind and the text is a different sequence.

## Follow-ups

- **Level 2:** Which sublayer exists only in the encoder-decoder shape? Expected: cross-attention, with queries from the decoder and keys and values from the encoder.
- **Level 3:** Why can a decoder-only model also do comprehension tasks? Expected: the same next-token model answers a question by continuing a prompt, and in-context learning lets it follow examples without a task head.
- **Level 3:** When would you still choose encoder-decoder for a text task? Expected: when the input is a clear source sequence that the output transforms, such as translation or summarization of a fixed document.
- **Level 4:** The ranking team wants to reuse the decoder they already serve. How? Expected: prompt it and read the logits of a label token, or attach a head and fine-tune; weigh the cost against an encoder that scores documents in one pass.

## Wrong answers

- "A decoder-only model cannot classify." It can, by prompting or by adding a head; the point is that an encoder is often cheaper for that job.
- "An encoder generates text one token at a time." It has no causal loss and predicts masked positions; it is not trained to continue a sequence.
- "Every transformer block has cross-attention." Only the decoder blocks of an encoder-decoder model have it.

## Taught in

The [full transformer lesson](../../../phases/07-transformers-deep-dive/05-full-transformer/) gives the three shapes and the picking table, and the [causal language modeling lesson](../../../phases/07-transformers-deep-dive/07-gpt-causal-language-modeling/) contrasts the two losses.
