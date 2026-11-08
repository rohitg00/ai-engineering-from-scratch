---
id: design-tokenizer-for-new-model
title: Design the tokenizer for a multilingual coding model
card: tokenization-decoding
kind: design
level: 4
roles: [ai-data-engineer, applied-ai-engineer, inference-engineer]
rounds: [system-design, design-review]
tags: [tokenizer-design, vocabulary-size, character-coverage, multilingual, code]
minutes: 15
lessons: [phases/05-nlp-foundations-to-advanced/19-subword-tokenization, phases/10-llms-from-scratch/01-tokenizers, phases/10-llms-from-scratch/02-building-a-tokenizer]
manuals: []
practice: []
cheatsheet: [tokenization]
related: [tokenization-decoding/vocab-size-tradeoff, tokenization-decoding/multilingual-tax, tokenization-decoding/tokenizer-drift-ci]
updated: 2026-11-03
---

You are starting a 7B model that must serve many languages and also be strong at code. Design its tokenizer: the algorithm, the library, the vocabulary size, the coverage settings, and the validation plan you would gate the training run on.

## Short answer

Train a byte-fallback subword vocabulary on a corpus that mirrors the target mix of languages and code, with a pre-tokenizer that keeps leading spaces and separates digits and punctuation so that code tokenizes cleanly. For a model in the 1 to 10B range the heuristic is 50 to 100k tokens, and the multilingual requirement pushes to the top of that range or beyond it; set the character coverage near 0.9995 so that rare scripts are kept rather than mapped to unknown. Gate on tokens per word per language, the unknown rate, the compression ratio against a reference encoder and a byte-exact round trip, and freeze the tokenizer file hash in CI before the first training step.

## Full answer

### Algorithm and library

The lesson's table points to the prune-based algorithm trained on raw text for multilingual work, because it needs no language-specific pre-tokenization and handles scripts without spaces, and to the merge-based algorithm for monolingual corpora. For a mixed requirement either works if the corpus is right; the corpus mix decides more than the algorithm. Use a library that trains, not one that only encodes against someone else's vocabulary. Keep byte fallback on in either case so that no input is ever unknown.

### Vocabulary size

| Model scale | Heuristic |
|---|---|
| under 1B | about 32k |
| 1 to 10B | 50 to 100k |
| multilingual or frontier | 200k and above |

A 7B model with many scripts sits at the top of the middle row. Each added row is an embedding to learn, and the embedding matrix at 128,000 rows by 4,096 dimensions is about 524M parameters, so the size is a budget decision and not a constant. The payoff is fertility: an English-heavy vocabulary gives other scripts 2 to 3 tokens per word or worse, and non-Latin text can cost 5 to 10 times more tokens; the larger multilingual vocabulary is what repairs that.

### Coverage and code

- Character coverage near 0.9995 for a mixed corpus; refuse anything under 0.995 when rare scripts are present.
- Byte fallback for everything the coverage still misses.
- A pre-tokenizer that keeps the leading space on words, splits digit runs and punctuation, and handles whitespace runs, so that indentation and operators in code become stable pieces. Chinese characters are 3 bytes each and need merges of their own, so the corpus must contain enough of them.
- Reserve the special tokens and the chat markers at the start, with fixed ids that no merge can produce.

### The corpus

Sample the training text for the tokenizer in the proportions you want the model to be good at. A domain vocabulary can also be trained on the code corpus and merged with the base vocabulary. A tokenizer trained on an English-heavy sample will under-serve every other script for the life of the model.

### The validation plan

1. Tokens per word, per language and for code, on held-out text; this is the fertility table you publish.
2. Unknown rate, which must be zero with byte fallback.
3. Compression ratio against a reference encoder on the same held-out text.
4. Round trip, encode then decode, on all of it, including emoji and literal special-token strings. Byte-exact when the tokenizer has no normalizer; with a normalizer such as NFKC, compare against the normalized text.
5. A frozen tokenizer file hash and golden token ids in CI, so that nothing drifts between training and serving.

Flag a monolingual vocabulary under 16k as under-specified, and refuse to ship a vocabulary without the hash check.

## Follow-ups

- **Level 3:** Why does the corpus mix matter more than the algorithm choice? Expected: the merges or the pruned pieces follow the frequencies in the training text, so a script that is rare in the sample gets few pieces whatever the algorithm.
- **Level 4:** What does whitespace handling do to code? Expected: indentation is runs of spaces or tabs; a pre-tokenizer that keeps whitespace runs as their own chunks lets them become stable tokens instead of being glued to the next word.
- **Level 4:** The team wants to change the vocabulary after six months of training. What do you tell them? Expected: the embeddings and every weight were trained against the current ids; a change means a retrain, which is why the tokenizer decision is gated before the first step.
- **Level 4:** How do you report the tokenizer with the model? Expected: the fertility table per language, the size and coverage of the vocabulary, the special-token list and the file hash.

## Wrong answers

- "Pick 32k because earlier models used it." That size served monolingual models under 1B; a 7B multilingual coding model pays the tax in every language.
- "Set character coverage to 1.0 to be safe." Full coverage spends vocabulary on characters seen once; near 0.9995 with byte fallback keeps rare scripts without wasting rows.
- "Train on English now and add the other languages later." The vocabulary cannot change after training without a retrain; the languages must be in the tokenizer corpus from the start.

## Taught in

The [subword tokenization lesson](../../../phases/05-nlp-foundations-to-advanced/19-subword-tokenization/) gives the picking table, the size heuristic, the coverage rule and the validation plan, the [tokenizers lesson](../../../phases/10-llms-from-scratch/01-tokenizers/) does the embedding and fertility arithmetic, and the [tokenizer build lesson](../../../phases/10-llms-from-scratch/02-building-a-tokenizer/) covers pre-tokenization, byte counts and special tokens.
