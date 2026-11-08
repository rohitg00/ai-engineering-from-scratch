## Why the merge must not overlap

The pair `(a, a)` in `[a, a, a]` matches at position 0 and at position 1. Both matches use the middle symbol. One symbol cannot become part of two new symbols, so the scan skips past a match. The result `[new, a]` keeps every original symbol exactly once. Decoding then gives back the same bytes.

## Why a fixed tie rule

Pair counts tie often in a small corpus. Python's `max` on a dict returns the first key with the highest count, and that key depends on the order in which the words came in. A tie rule on the pair itself makes training deterministic. Two runs over the same corpus then give the same merge table, and the same text gives the same ids.

## Why the minimum count of 2

A pair that occurs once saves one symbol in one word. It adds an id to the vocabulary that the model almost never sees. The capstone stops training at that point.

## Speed

This loop counts every pair again after each merge. A production trainer keeps the pair counts and updates only the words that contain the merged pair. The result is the same.

## Where this goes next

The encoder applies the merge list in training order to new text. The tokenizer lesson in the LLM phase adds pre-tokenization and special tokens around the same merge step.
