---
id: read-the-decoder-round-trip
title: Two decoders, one breaks on an emoji
card: tokenization-decoding
kind: code-reading
level: 2
roles: [applied-ai-engineer, ai-data-engineer, inference-engineer]
rounds: [coding, debugging]
tags: [bpe, decoding, utf-8, round-trip, code-reading]
minutes: 8
lessons: [phases/19-capstone-projects/30-bpe-tokenizer-from-scratch, phases/10-llms-from-scratch/01-tokenizers, phases/10-llms-from-scratch/02-building-a-tokenizer]
manuals: []
practice: []
cheatsheet: [tokenization]
related: [tokenization-decoding/merge-order-at-encode]
updated: 2026-11-03
---

Two versions of a byte-level tokenizer's decode function came in for review. `vocab` maps each id to a `bytes` object.

```python
def decode_a(self, ids):
    byte_sequence = b"".join(self.vocab[t] for t in ids)
    return byte_sequence.decode("utf-8", errors="replace")

def decode_b(self, ids):
    return "".join(self.vocab[t].decode("utf-8") for t in ids)
```

Both pass the English tests. Which one is correct for an emoji whose bytes were split across two tokens, why does the correct one always terminate, and what is `errors="replace"` for?

## Short answer

Join all the bytes first and decode once, which is what `decode_a` does. A multi-byte character such as an emoji, 4 bytes in UTF-8, can be split across two or more tokens, so decoding each token's bytes alone hits an incomplete sequence and raises or emits replacement characters. The join works because every id is either one of the 256 raw bytes or the concatenation of two earlier ids, so expanding ids to bytes always ends in raw bytes, and the full byte string is valid UTF-8 whenever the input was. The `replace` option keeps the decoder from raising when a model emits a partial character at the end of a stream.

## Full answer

### Why the split happens

A byte-level vocabulary starts from single bytes and learns merges from the corpus. An emoji that was rare in training may have no merge covering all 4 of its bytes, so the encoder leaves it as two tokens, perhaps 3 bytes and 1 byte. Each token on its own is not valid UTF-8. The characters of a script with 3-byte characters have the same problem whenever a merge covers part of a character.

### Why the join terminates and round-trips

The capstone states the guarantee: encode then decode returns the input bytes exactly. The decoder concatenates the byte expansion of every id in order. Because every id is a raw byte or the concatenation of two known ids, the recursive expansion bottoms out in raw bytes, and the concatenation of all tokens is the original byte string. UTF-8 decoding then recovers the text. The test suite pins the property on an unseen sentence, on a sentence with an emoji, and on a sentence that contains a literal special-token string.

### Special tokens on the way out

The capstone's decoder checks a special-token table first and appends the marker's UTF-8 bytes, then falls through to the vocabulary, and raises on an id that is in neither. That keeps a reserved id from being looked up as a merge.

### What `errors="replace"` is for

A model can stop in the middle of a character, or a stream can be cut between two tokens that share a character. Strict decoding raises; `replace` emits a replacement character and continues. In a streaming decoder the better pattern is to buffer the trailing bytes until they form a complete character, and to use `replace` only at the final flush.

## Follow-ups

- **Level 2:** Why does `decode_b` pass the English tests? Expected: ASCII characters are single bytes, so no token ever holds a partial character and every piece decodes on its own.
- **Level 3:** Design the streaming decoder in two sentences. Expected: accumulate bytes and emit only the longest prefix that is complete UTF-8, keeping the remainder; flush with replacement at the end of the stream.
- **Level 3:** Why can a word-level tokenizer not give the round-trip guarantee? Expected: unseen words map to an unknown id, and the unknown id cannot be mapped back to the original text.
- **Level 3:** What three inputs does the capstone's test suite use for the round trip? Expected: an unseen sentence, a sentence with an emoji, and a sentence containing the literal special-token string.

## Wrong answers

- "Decode each token to a string and join the strings." A token can hold part of a character, and partial UTF-8 is not a string.
- "Tell the decoder to ignore errors so nothing ever raises." Ignoring drops bytes silently and the round trip is no longer exact; the replacement character at least marks the loss.
- "The round trip only matters for the training data." Every generated answer goes through decode, and a server that raises on an emoji drops the request.

## Taught in

The [BPE capstone](../../../phases/19-capstone-projects/30-bpe-tokenizer-from-scratch/) states and tests the round-trip guarantee, the [tokenizers lesson](../../../phases/10-llms-from-scratch/01-tokenizers/) gives the join-then-decode function, and the [tokenizer build lesson](../../../phases/10-llms-from-scratch/02-building-a-tokenizer/) gives the byte counts for emoji and other scripts.
