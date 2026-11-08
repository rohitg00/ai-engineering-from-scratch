## Hint 1

Keep two lists: `alive` and `finished`. Each item is a pair of a token tuple and a raw score. Start with `alive = [((bos_id,), 0.0)]`.

## Hint 2

At each step, build every candidate from every alive hypothesis first. Then sort the whole list once. Do not keep the best tokens of each beam on their own.

## Hint 3

The sort key `(-score, tokens)` puts the highest score first. For equal scores, Python compares the tuples, so the lower token ids come first.

## Hint 4

Move a kept candidate that ends with EOS to `finished`. When the loop ends, add the alive hypotheses to `finished`. Divide each raw score by `(len(tokens) - 1) ** length_penalty` only at the end, then sort again with the same key.
