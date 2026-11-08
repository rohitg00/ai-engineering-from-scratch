Speculative decoding makes a large model generate text faster with no change to its output. A small draft model proposes a few tokens. The large target model checks all of them in one forward pass. A rejection rule keeps the output distribution exactly equal to the distribution of the target model.

## Task

Write four functions. In this problem, $p$ is a distribution of the **target** model and $q$ is a distribution of the **draft** model, over a vocabulary of $V$ tokens.

1. `acceptance_rate(target, draft)` returns $\alpha = \sum_x \min(p(x), q(x))$. This is the probability that the rule accepts one draft token.
2. `residual_distribution(target, draft)` returns $\mathrm{norm}(\max(0, p - q))$: the elementwise maximum of 0 and $p - q$, divided by its sum. When that sum is 0, return a copy of `target` as a float array.
3. `speculative_step(target_probs, draft_probs, draft_tokens, rng)` runs the verify step for $\gamma$ draft tokens and returns the output tokens.
4. `expected_tokens(alpha, gamma)` returns the expected number of tokens of one step, $(1 - \alpha^{\gamma + 1}) / (1 - \alpha)$. For $\alpha = 1$ it returns $\gamma + 1$.

`speculative_step` does these steps. The order of the random draws is part of the task.

1. For each draft token $x_i$, with $i$ from 0 to $\gamma - 1$, let $p_i$ be row $i$ of `target_probs` and $q_i$ be row $i$ of `draft_probs`.
2. Draw $u$ = `rng.random()`. When $u < \min(1, p_i(x_i) / q_i(x_i))$, accept $x_i$, add it to the output, and go to the next draft token.
3. Otherwise, draw one token with `rng.choice(V, p=r)`, where $r$ is the residual distribution of $p_i$ and $q_i$. Add it to the output and return the output.
4. When all $\gamma$ draft tokens are accepted, draw one bonus token with `rng.choice(V, p=p_gamma)` from the last row of `target_probs`. Add it and return the output.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `target` | float array | `(V,)` | a target distribution $p$ |
| `draft` | float array | `(V,)` | a draft distribution $q$ |
| `target_probs` | float array | `(gamma + 1, V)` | the target distributions at each draft position and one more |
| `draft_probs` | float array | `(gamma, V)` | the draft distributions at each draft position |
| `draft_tokens` | list of int | length `gamma` | the tokens that the draft model sampled |
| `rng` | `np.random.Generator` | | the source of all random draws |
| `alpha` | float | | an acceptance rate from 0 to 1 |
| `gamma` | int | | the number of draft tokens |

- `acceptance_rate` returns a Python float.
- `residual_distribution` returns a float array of shape `(V,)` that sums to 1.
- `speculative_step` returns a list of Python ints of length from 1 to `gamma + 1`.
- `expected_tokens` returns a Python float.

## Constraints

- `2 <= V <= 64` and `0 <= gamma <= 8`. Each row of probabilities sums to 1.
- Each draft token has $q_i(x_i) > 0$, because the draft model sampled it. The target probability $p_i(x_i)$ can be 0.
- Use only `rng.random()` and `rng.choice(V, p=...)`, in the order above. Make no other draws.
- Do not change the input arrays or the list of draft tokens.
- Use numpy only.

## Examples

```python
target = np.array([0.5, 0.3, 0.2, 0.0])
draft = np.array([0.25, 0.25, 0.25, 0.25])
acceptance_rate(target, draft)
residual_distribution(target, draft)
```

```text
0.7
[0.83333333 0.16666667 0.         0.        ]
```

```python
target_probs = np.array([[0.5, 0.3, 0.2, 0.0], [0.1, 0.6, 0.2, 0.1], [0.25, 0.25, 0.25, 0.25]])
draft_probs = np.array([[0.25, 0.25, 0.25, 0.25], [0.4, 0.2, 0.2, 0.2]])
speculative_step(target_probs, draft_probs, [0, 1], np.random.default_rng(0))
speculative_step(target_probs, draft_probs, [3, 0], np.random.default_rng(0))
speculative_step(target_probs, draft_probs, [0, 0], np.random.default_rng(3))
```

```text
[0, 1, 0]
[0]
[0, 0, 3]
```

```python
expected_tokens(0.8, 4), expected_tokens(1.0, 4), expected_tokens(0.0, 4)
```

```text
(3.3616, 5.0, 1.0)
```
