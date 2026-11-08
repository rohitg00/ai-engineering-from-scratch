A language model gives one logit for each token of the vocabulary. The decoder must pick the next token from these logits. Temperature, top-k and top-p change the distribution before the draw. Every chat model in the course uses this sampling step.

## Task

Write four functions. Each `logits` argument is a 1D float array of length $V$.

1. `top_k_filter(logits, k)` keeps the `k` largest logits and sets every other entry to `-np.inf`. Sort by logit, highest first. When two logits are equal, the lower index comes first. If `k >= V`, keep every entry.
2. `top_p_filter(logits, p)` computes $\mathrm{softmax}(z)$ and sorts the tokens by probability, highest first, with the same tie rule. It keeps the shortest prefix of the sorted tokens whose cumulative probability is $\ge p$. The token that makes the sum reach $p$ is kept. If no prefix reaches $p$ because of rounding, keep every token. Every other entry becomes `-np.inf`.
3. `sampling_probs(logits, temperature=1.0, top_k=None, top_p=None)` returns the final distribution. Apply the steps in this order:
   1. Divide the logits by `temperature`.
   2. If `top_k` is not `None`, apply `top_k_filter`.
   3. If `top_p` is not `None`, apply `top_p_filter` to the result of step 2.
   4. Take the softmax. A removed token gets probability exactly 0.
4. `sample(logits, rng, temperature=1.0, top_k=None, top_p=None)` draws one token index. Compute the probabilities with `sampling_probs`. Call `u = rng.random()` exactly once. Let $c$ be the cumulative sum of the probabilities in vocabulary order. Return the smallest index $i$ with $u < c_i$. If no index satisfies this because of rounding, return the largest index that has a probability above 0.

The softmax of $z$ is $e^{z_i} / \sum_j e^{z_j}$. Entries equal to `-np.inf` get probability 0.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `logits` | float array | `(V,)` | one score for each token |
| `k` | int | scalar | the number of tokens to keep, `k >= 1` |
| `p` | float | scalar | the probability mass to keep, `0 < p <= 1` |
| `temperature` | float | scalar | the divisor of the logits, `temperature > 0` |
| `rng` | `np.random.Generator` | object | the source of the random number |

- `top_k_filter` and `top_p_filter` return a float array of shape `(V,)`. Kept entries have their input values. Removed entries are `-np.inf`.
- `sampling_probs` returns a float array of shape `(V,)` that sums to 1.
- `sample` returns an `int`.

## Constraints

- `1 <= V <= 50000`.
- Logits are finite floats and can be larger than 700.
- Do not change the input array.
- Use numpy only.

## Examples

```python
logits = np.array([2.0, 1.0, 0.5, 0.5, -1.0])
top_k_filter(logits, 3)
```

```text
[ 2.   1.   0.5 -inf -inf]
```

Indices 2 and 3 have the same logit. The lower index 2 is kept.

```python
top_p_filter(logits, 0.8)
```

```text
[ 2.   1.   0.5 -inf -inf]
```

The sorted probabilities have the cumulative sums 0.5365, 0.7339 and 0.8536. The third token makes the sum reach 0.8, so it is kept.

```python
sampling_probs(logits, temperature=0.5, top_k=3)
```

```text
[0.84379473 0.1141952  0.04201007 0.         0.        ]
```

```python
sample(logits, np.random.default_rng(0), top_k=3)
```

```text
1
```
