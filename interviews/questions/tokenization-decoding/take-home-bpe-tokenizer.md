---
id: take-home-bpe-tokenizer
title: Take-home, a byte-level tokenizer with tests
card: tokenization-decoding
kind: take-home
level: 3
roles: [applied-ai-engineer, ai-data-engineer, inference-engineer]
rounds: [take-home, coding]
tags: [take-home, bpe, byte-level, special-tokens, round-trip]
minutes: 15
lessons: [phases/19-capstone-projects/30-bpe-tokenizer-from-scratch, phases/10-llms-from-scratch/02-building-a-tokenizer, phases/10-llms-from-scratch/01-tokenizers]
manuals: []
practice: [bpe-merge-step]
cheatsheet: [tokenization]
related: [tokenization-decoding/bpe-training-loop, tokenization-decoding/read-the-decoder-round-trip]
updated: 2026-11-03
---

This is a take-home we send: implement a byte-level byte-pair tokenizer with training, encoding and decoding, two reserved special tokens, and a test suite. Describe the design you would submit, the tests you would ship, and the one figure you would include in the write-up.

## Short answer

Reserve ids 0 to 255 for the raw bytes and a small block above them for the end-of-text and pad markers, split the corpus on whitespace and punctuation, train by counting frequency-weighted adjacent pairs and merging the top pair with a deterministic tie-break, encode by applying the lowest-ranked merge that fits until none fits, and decode by joining the byte expansions and decoding UTF-8 once. The tests pin the byte-exact round trip on an unseen sentence, on an emoji and on a literal special-token string with the allow flag on and off, plus the merge-order property and the reserved ids. The figure is the compression curve: the encoded length of a held-out sentence as the target vocabulary grows from 300 to 600.

## Full answer

### The design

```text
ids 0..255        raw bytes
next few ids      <|endoftext|>, <|pad|>
then              one id per merge, in training order
```

- **Keep the input bytes** as they are, so that the round trip is byte-exact. Compatibility normalization maps a ligature or a fullwidth letter to its plain form and is lossy, so add it only if the write-up limits the round-trip promise to normalized text.
- **Pre-split** into words and punctuation so that merges stay inside a word; the regex pattern of the large production tokenizers is an optional extension.
- **Train**: count adjacent pairs across the split corpus weighted by word frequency, merge the top pair into the next free id, record the merge, repeat to the target size. Break ties on the pair itself so two runs give the same table.
- **Encode**: match special tokens exactly first when the allow flag is on; for ordinary text start from the bytes and repeatedly apply the lowest-ranked applicable merge.
- **Decode**: special ids map to their marker strings, every other id to its bytes; join all bytes, then decode once with replacement for a partial trailing character.

### The tests

1. Round trip on a sentence the tokenizer never saw.
2. Round trip on a sentence with an emoji, where the character's 4 bytes may span tokens.
3. Round trip on a sentence containing the literal end-of-text string, with the flag off it becomes bytes and with the flag on it becomes the reserved id.
4. Merge order: a held-out word encodes to the recorded ids, and a shuffled table does not.
5. Reserved ids never appear as merge targets and never collide with byte ids.
6. Determinism: training twice on the same corpus gives the same table.

### The figure

Train to several target sizes, encode the same held-out sentence each time, and plot the token count against the vocabulary size. The count falls as merges cover longer pieces. A second line with the compression ratio, tokens over input bytes where 0.50 means half as many tokens as bytes, shows the same thing in a unit that transfers between corpora.

### What a reviewer grades

Correctness of the round trip, determinism, clean separation of the special-token path from the merge path, the quality of the tests, and a write-up that names the bug the candidate hit. Speed is not graded: Python at this scale finishes in well under a second, and production libraries in compiled languages are 10 to 100 times faster for the same algorithm.

## Follow-ups

- **Level 2:** Why do the raw bytes take ids 0 to 255 before anything else? Expected: every input can then be expressed in the vocabulary before any merge exists, so nothing is ever unknown.
- **Level 3:** The input spells out the end-of-text marker as plain text. What does the allow flag change? Expected: off, the string is ordinary bytes and pieces; on, it maps to the reserved id and is skipped by the merge loop.
- **Level 3:** Why must a tie in pair counts be broken deterministically? Expected: two runs on the same corpus must give the same table, or the same text gets different ids across machines.
- **Level 4:** Replace the simple split with the production regex pattern. What do you compare? Expected: the vocabularies and the encoded lengths on the same corpus, looking at how contractions, digits and leading spaces are handled.

## Wrong answers

- "Use Unicode code points as the base symbols." Code points number in the hundreds of thousands and leave gaps for unseen characters; bytes are 256 and complete.
- "Decode each token to a string and join the strings." A token can hold part of a multi-byte character; join the bytes first and decode once.
- "Skip the pre-split to get better compression." Merges then cross word boundaries and the vocabulary fills with phrases that do not transfer.

## Taught in

The [BPE capstone](../../../phases/19-capstone-projects/30-bpe-tokenizer-from-scratch/) defines the design, the special tokens and the tests, the [tokenizer build lesson](../../../phases/10-llms-from-scratch/02-building-a-tokenizer/) adds normalization and the regex extension, and the [tokenizers lesson](../../../phases/10-llms-from-scratch/01-tokenizers/) defines the compression ratio.
