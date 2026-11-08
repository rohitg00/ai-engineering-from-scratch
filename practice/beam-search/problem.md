Greedy decoding picks the best token at each step and can never go back. Beam search keeps the `beam_width` best partial sequences at each step and picks the best finished one at the end. Translation and summarization models decode with beam search.

## Task

Write `beam_search(step_fn, bos_id, eos_id, beam_width, max_len, length_penalty=0.0)`.

A hypothesis is a tuple of token ids and a raw score. The search starts with one alive hypothesis: the tuple `(bos_id,)` with score 0. The raw score of a hypothesis is the sum of $\log p(t_i \mid t_{<i})$ over its generated tokens.

Repeat at most `max_len` times:

1. For each alive hypothesis, call `step_fn(tokens)` once. It returns the log-probs of the next token, a float array of length $V$.
2. Make one candidate for each alive hypothesis and each token id from 0 to $V - 1$. The candidate score is the parent score plus the log-prob of the token.
3. Sort all candidates by raw score, highest first. For equal scores, the smaller token tuple comes first, in Python tuple order. Keep the first `beam_width` candidates.
4. A kept candidate that ends with `eos_id` is finished. The other kept candidates are the new alive hypotheses.
5. Stop when no hypothesis is alive.

After the loop, the hypotheses that are still alive are also part of the result. Each hypothesis then gets its final score $s / L^{\alpha}$, where $s$ is the raw score, $L$ is the number of generated tokens (BOS does not count, EOS counts) and $\alpha$ is `length_penalty`. With $\alpha = 0$ the final score is the raw score. The length penalty does not change the pruning in step 3.

Return every finished hypothesis as a list of `(tokens, final_score)` pairs. Sort the list by final score, highest first. For equal scores, the smaller token tuple comes first. The first pair is the answer of the search.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `step_fn` | function | tuple of ints to float array `(V,)` | the log-probs of the next token after a prefix |
| `bos_id` | int | scalar | the first token of every sequence |
| `eos_id` | int | scalar | the token that finishes a sequence, from 0 to `V - 1` |
| `beam_width` | int | scalar | the number of candidates to keep at each step, `>= 1` |
| `max_len` | int | scalar | the largest number of generated tokens, `>= 1` |
| `length_penalty` | float | scalar | the exponent $\alpha$ of the length in the final score |

- Returns a list of `(tokens, score)` pairs. `tokens` is a tuple of ints that starts with `bos_id`. `score` is a float.

## Constraints

- `2 <= V <= 50` and `max_len <= 20`.
- Never call `step_fn` on a prefix that ends with `eos_id`.
- `step_fn` can return a new array on each call. Do not change the arrays that it returns.
- Use Python and numpy only.

## Examples

The toy model has $V = 4$, BOS 4 and EOS 0. It gives these probabilities for the next token:

```python
TABLE = {
    (4,): [0.05, 0.5, 0.4, 0.05],
    (4, 1): [0.25, 0.25, 0.25, 0.25],
    (4, 2): [0.9, 0.04, 0.03, 0.03],
}

def toy(prefix):
    return np.log(np.array(TABLE.get(tuple(prefix), [0.6, 0.2, 0.1, 0.1])))
```

```python
beam_search(toy, 4, 0, 1, 3)
```

```text
[((4, 1, 0), -2.0794415416798357)]
```

```python
beam_search(toy, 4, 0, 2, 3)
```

```text
[((4, 2, 0), -1.0216512475319812), ((4, 1, 0), -2.0794415416798357)]
```

```python
beam_search(toy, 4, 0, 2, 3, length_penalty=1.0)
```

```text
[((4, 2, 0), -0.5108256237659906), ((4, 1, 0), -1.0397207708399179)]
```
