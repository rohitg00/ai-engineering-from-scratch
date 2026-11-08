A decoder turns the logits of the next token into a distribution and draws from it. Temperature changes how flat that distribution is. Top p then cuts off the tail. In this lab you sweep the temperature on fixed logits and measure the entropy, the top 1 probability and the number of tokens that top p keeps.

`support.py` gives the 10 token vocabulary and the logits from the GPT lesson demo, `LOGITS = [3.2, 1.1, 2.8, 0.4, 0.9, 1.5, -0.2, 2.1, 0.7, 0.1]`. It also gives the grid `TEMPERATURES` from 0.1 to 3.0 in steps of 0.1, `TARGET_ENTROPY = 2.0` bits and `TOP_P = 0.9`.

## Task

Write five helper functions and `answers()`.

1. `softmax_t(logits, temperature)` returns $p_i = e^{z_i / T} / \sum_j e^{z_j / T}$. It must not overflow for large logits or a small $T$.
2. `entropy_bits(probs)` returns $H = -\sum_i p_i \log_2 p_i$ in bits. A zero probability adds 0.
3. `sweep_temperature(logits, temperatures)` returns two float arrays of the length of `temperatures`: the entropy and the top 1 probability $\max_i p_i$ at each temperature.
4. `temperature_for_entropy(logits, target, lo=0.05, hi=10.0, iters=60)` finds the temperature where the entropy equals `target`, by bisection. Do `iters` rounds. In each round, let $m$ be the midpoint of `lo` and `hi`. If the entropy at $m$ is below `target`, move `lo` to $m$. Else move `hi` to $m$. After the last round, return the midpoint of `lo` and `hi`.
5. `kept_count(probs, p)` sorts the probabilities from high to low and returns the length of the shortest prefix whose cumulative sum is greater than or equal to `p`. If no prefix reaches `p` because of rounding, it returns the number of tokens.

Then do the experiment in `answers()`.

1. Set the temperature to 1.0. Report the entropy as `entropy_t1`.
2. Set the temperature to 0.7. Report the top 1 probability as `top1_t07`.
3. Change the temperature over `TEMPERATURES`. Measure the entropy at each one. Report the first grid temperature with an entropy greater than or equal to `TARGET_ENTROPY` as `first_grid_temperature`.
4. Find the exact crossing with `temperature_for_entropy(LOGITS, TARGET_ENTROPY)`. Report it as `crossing_temperature`.
5. Apply top p with `TOP_P` at the temperatures 0.7, 1.0 and 1.5. Report the kept counts as `kept_p09_t07`, `kept_p09_t10` and `kept_p09_t15`.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `logits` | float array | `(V,)` | one score for each token |
| `temperature` | float | scalar | the divisor $T$ of the logits, $T > 0$ |
| `probs` | float array | `(V,)` | a distribution that sums to 1 |
| `temperatures` | list of floats | `(k,)` | the temperatures of the sweep |
| `target` | float | scalar | the entropy to reach, in bits |
| `p` | float | scalar | the top p mass, `0 < p <= 1` |

- `softmax_t` returns a float array of shape `(V,)`.
- `entropy_bits` returns a float.
- `sweep_temperature` returns a tuple of two float arrays of shape `(k,)`.
- `temperature_for_entropy` returns a float. `kept_count` returns an int.
- `answers()` returns a dict with the seven keys above. Each value is a Python `float`.

## Constraints

- `2 <= V <= 1000`. The logits are finite and can be larger than 700.
- Do not change the input arrays.
- Do not round the answers. The checks accept a relative difference of `1e-6` from the reference run.
- Use numpy and the standard library only.

## Examples

```python
softmax_t(np.array([1.0, 2.0, 3.0]), 0.5)
```

```text
[0.01587624 0.11731043 0.86681333]
```

```python
entropy_bits(np.array([0.5, 0.25, 0.25]))
```

```text
1.5
```

```python
sweep_temperature(LOGITS, [0.5, 1.0, 2.0])
```

```text
(array([1.50271532, 2.52573217, 3.09650953]), array([0.61269561, 0.38024152, 0.22636197]))
```

```python
kept_count(np.array([0.1, 0.6, 0.3]), 0.8)
```

```text
2
```
