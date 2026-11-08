PPO trains a policy for several epochs on one batch of samples. The importance ratio compares the new policy with the policy that collected the samples. PPO clips this ratio, so that one update cannot move the policy too far. The same clipped loss is the core of many RLHF pipelines.

## Task

Write three functions. Each takes the new log probabilities, the old log probabilities and the advantages of $N$ samples, and the clip size `eps`.

1. `ppo_clip_loss(logp_new, logp_old, advantages, eps=0.2)` returns the loss to minimize.
2. `clip_fraction(logp_new, logp_old, advantages, eps=0.2)` returns the fraction of clipped samples.
3. `ppo_clip_grad(logp_new, logp_old, advantages, eps=0.2)` returns the gradient of the loss with respect to `logp_new`.

The ratio of sample $t$ is $r_t = \exp(\log\pi_{new,t} - \log\pi_{old,t})$. The loss is:

$$L = -\frac{1}{N} \sum_t \min\left(r_t A_t,\ \mathrm{clip}(r_t, 1 - \epsilon, 1 + \epsilon) A_t\right)$$

Sample $t$ is clipped when $A_t > 0$ and $r_t > 1 + \epsilon$, or when $A_t < 0$ and $r_t < 1 - \epsilon$. Both comparisons are strict. A sample with $A_t = 0$ is not clipped.

The gradient of a clipped sample is 0. The gradient of any other sample is $-r_t A_t / N$.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `logp_new` | float array | `(N,)` | the log probability of each action under the new policy |
| `logp_old` | float array | `(N,)` | the log probability of each action under the old policy |
| `advantages` | float array | `(N,)` | the advantage of each sample, used as given |
| `eps` | float | | the clip size, from 0 to 1 |

- `ppo_clip_loss` returns a float.
- `clip_fraction` returns a float from 0 to 1.
- `ppo_clip_grad` returns a float array of shape `(N,)`.

## Constraints

- `1 <= N <= 4096`.
- Log probabilities are from -1000 to 0.
- Do not normalize the advantages.
- Do not change the input arrays.
- Use numpy only.

## Examples

```python
logp_old = np.log(np.array([0.5, 0.5, 0.5, 0.5]))
logp_new = np.log(np.array([0.7, 0.55, 0.3, 0.45]))
advantages = np.array([1.0, 2.0, -1.0, -0.5])
ppo_clip_loss(logp_new, logp_old, advantages)
clip_fraction(logp_new, logp_old, advantages)
ppo_clip_grad(logp_new, logp_old, advantages)
```

```text
-0.5375000000000001
0.5
[ 0.     -0.55    0.      0.1125]
```

The ratios are `[1.4, 1.1, 0.6, 0.9]`. Sample 0 has $A > 0$ and $r > 1.2$. Sample 2 has $A < 0$ and $r < 0.8$. These two samples are clipped.
