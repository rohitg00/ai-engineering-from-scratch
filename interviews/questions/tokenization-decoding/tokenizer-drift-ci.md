---
id: tokenizer-drift-ci
title: The weights did not change and the score fell
card: tokenization-decoding
kind: debug
level: 3
roles: [ai-evaluation-reliability-engineer, applied-ai-engineer, ai-data-engineer]
rounds: [debugging, design-review]
tags: [tokenizer-drift, normalization, prefix-space, ci, evaluation]
minutes: 10
lessons: [phases/05-nlp-foundations-to-advanced/19-subword-tokenization, phases/10-llms-from-scratch/02-building-a-tokenizer]
manuals: []
practice: []
cheatsheet: [tokenization]
related: [tokenization-decoding/chat-template-garbage, tokenization-decoding/pre-tokenization-regex]
updated: 2026-11-03
---

After a routine dependency upgrade, an evaluation score for a deployed model fell sharply. No model weights changed. Give me a diagnosis plan that starts at the tokenizer, and the control you add so it cannot happen again.

## Short answer

A model trained with one vocabulary and served with another gets different ids for the same text and produces garbage, so first hash the tokenizer file in both environments and compare. If the hashes match, check the settings that change ids without changing the vocabulary: whether special tokens are added, whether a prefix space is added, and the normalization step, because a leading space or a ligature that normalizes differently moves whole tokens. Then freeze the tokenizer hash in CI and keep golden token ids for a fixed corpus so any change fails a test before it ships.

## Full answer

### Step one: the file

The merge table and the vocabulary are the tokenizer. A library upgrade can pull a different file, or resolve a model name to a newer revision. Compare the hash of the tokenizer file in the evaluation environment with the one the model was trained with.

### Step two: the settings around the file

| Setting | What changes | Symptom |
|---|---|---|
| Add special tokens | a begin-of-text id appears or disappears at the start | every position shifts by one |
| Add prefix space | the first word gets a word-initial id or a word-internal id | the first token of every prompt differs |
| Normalization | a ligature such as the two-letter "fi" becomes two characters, or a fullwidth letter becomes ASCII | the same word gets different pieces in the two environments |
| Pre-tokenizer engine | the Unicode-aware pattern falls back to ASCII classes | non-Latin text splits differently |

Each of these is a default that a library version can change. None of them touches the vocabulary file, so the hash alone does not catch them.

### Step three: prove it

Take a fixed sample of prompts from the evaluation. Encode them in both environments and diff the id lists. The first position that differs tells you which setting moved. Decode the differing ids to see the pieces.

### The controls

1. Pin the tokenizer file by hash in the deployment and fail the build when it changes.
2. Store golden token ids for a fixed corpus that covers English, non-Latin scripts, code, emoji and a prompt with a leading space; the test encodes the corpus and compares.
3. Assert a round trip, encode then decode, on the same corpus. Compare against the text that the configured normalizer produces, and require byte-exact equality for text that the normalizer leaves unchanged.
4. Record the tokenizer settings next to the weights, so the serving config cannot drift from the training config.

### The validation plan from the lesson

Average tokens per word on a held-out set, the unknown rate, the compression ratio and the round-trip equality. Those four numbers, tracked over time, show drift before an evaluation does.

## Follow-ups

- **Level 3:** How does a prefix space change the ids? Expected: the space is part of the word-initial token, so with it the first word gets one id and without it another, and the shift can continue through the merges.
- **Level 3:** What does the compatibility normalization do, and when is it harmful? Expected: it maps compatibility characters to their plain forms, such as a ligature to two letters or a fullwidth letter to ASCII; it is lossy, so code or text that depends on the exact form changes meaning.
- **Level 4:** The hashes match and the ids still differ on non-Latin text only. What moved? Expected: the pre-tokenizer engine; the environment without the Unicode-aware module fell back to the ASCII pattern.
- **Level 4:** Design the CI gate in two sentences. Expected: a test that encodes a fixed multilingual corpus and compares against stored golden ids and a stored tokenizer hash; any difference fails the build and prints the first differing position.

## Wrong answers

- "The weights did not change, so the model is the same." The model is the weights and the mapping from text to ids; change the mapping and the model sees different inputs.
- "Retrain the model on the new tokenizer." A multi-week fix for a configuration bug; restore the training-time tokenizer and settings.
- "Lowercase everything so the normalization does not matter." That changes the ids again and throws away information the model was trained with.

## Taught in

The [subword tokenization lesson](../../../phases/05-nlp-foundations-to-advanced/19-subword-tokenization/) lists the drift and whitespace pitfalls and the validation plan, and the [tokenizer build lesson](../../../phases/10-llms-from-scratch/02-building-a-tokenizer/) covers normalization and the regex engines.
