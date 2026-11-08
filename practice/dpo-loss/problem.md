Direct preference optimization (DPO) trains a language model on pairs of responses. A person preferred one response of each pair and rejected the other. DPO needs no separate reward model. The log probability ratio between the policy and a frozen reference model acts as the reward.

## Task

Write three functions. Each input holds one sequence log probability for each pair in a batch of $N$ pairs.

1. `implicit_reward(policy_logprob, ref_logprob, beta)` returns the implicit reward $r = \beta \, (\log \pi(y \mid x) - \log \pi_{ref}(y \mid x))$ for each pair.
2. `dpo_loss(...)` returns the mean DPO loss over the batch.
3. `dpo_grad(...)` returns the gradient of that mean loss with respect to the two policy log probabilities.

Let $r_w$ be the implicit reward of the preferred response and $r_l$ the implicit reward of the rejected response. The margin of pair $i$ is $z_i = r_{w,i} - r_{l,i}$. The loss is

$$L = \frac{1}{N} \sum_{i=1}^{N} -\log \sigma(z_i), \qquad \sigma(z) = \frac{1}{1 + e^{-z}}.$$

The gradient of $L$ with respect to the preferred policy log probability of pair $i$ is $-\beta \, \sigma(-z_i) / N$. The gradient with respect to the rejected policy log probability is $+\beta \, \sigma(-z_i) / N$. The reference log probabilities are constants.

## Input and output

All four log probability arguments have the same order of names in `dpo_loss` and `dpo_grad`: `policy_logprob_preferred`, `policy_logprob_rejected`, `ref_logprob_preferred`, `ref_logprob_rejected`.

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `policy_logprob` | float array | `(N,)` | log probability of a response under the policy |
| `ref_logprob` | float array | `(N,)` | log probability of the same response under the reference |
| `policy_logprob_preferred` | float array | `(N,)` | policy log probability of each preferred response |
| `policy_logprob_rejected` | float array | `(N,)` | policy log probability of each rejected response |
| `ref_logprob_preferred` | float array | `(N,)` | reference log probability of each preferred response |
| `ref_logprob_rejected` | float array | `(N,)` | reference log probability of each rejected response |
| `beta` | float | | the strength of the reference constraint, above 0 |

- `implicit_reward` returns a float array of shape `(N,)`.
- `dpo_loss` returns a Python float.
- `dpo_grad` returns a tuple `(grad_preferred, grad_rejected)` of two float arrays of shape `(N,)`.

## Constraints

- `1 <= N <= 1000` and `0 < beta <= 10`.
- A log probability can be as small as `-5000`. The margin can be as large as several thousand in either direction. The loss and the gradient must stay finite and exact.
- Do not add a small constant inside a log. Use a stable form of $-\log \sigma(z)$.
- Do not change the input arrays.
- Use numpy only.

## Examples

```python
policy_preferred = np.array([-12.0, -20.0, -8.0])
policy_rejected = np.array([-15.0, -18.0, -9.0])
ref_preferred = np.array([-13.0, -19.0, -8.5])
ref_rejected = np.array([-14.0, -19.0, -8.5])
implicit_reward(policy_preferred, ref_preferred, 0.1)
implicit_reward(policy_rejected, ref_rejected, 0.1)
```

```text
[ 0.1  -0.1   0.05]
[-0.1   0.1  -0.05]
```

```python
dpo_loss(policy_preferred, policy_rejected, ref_preferred, ref_rejected, 0.1)
```

```text
0.6802247996122515
```

```python
grad_preferred, grad_rejected = dpo_grad(policy_preferred, policy_rejected, ref_preferred, ref_rejected, 0.1)
```

```text
grad_preferred
[-0.01500553 -0.0183278  -0.01583403]
grad_rejected
[0.01500553 0.0183278  0.01583403]
```
