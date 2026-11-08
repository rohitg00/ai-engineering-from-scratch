GRPO trains a language model with reinforcement learning and no value network. For each prompt it samples a group of $G$ answers and scores each answer. The baseline of an answer is the mean reward of its group. The update uses the clipped surrogate of PPO and a KL penalty toward a frozen reference model.

## Task

Write three functions.

1. `group_advantages(rewards, eps=1e-8)` returns the group-relative advantages.
2. `kl_k3(logp, ref_logp)` returns the k3 estimate of the KL divergence for each token.
3. `grpo_objective(logp, old_logp, ref_logp, advantages, mask, clip_eps=0.2, beta=0.04)` returns the GRPO objective as a float. Training maximizes it.

**Advantages.** Each row of `rewards` is one group. For reward $r_i$ in a group with mean $\mu$ and population standard deviation $\sigma$ (divide by $G$, not by $G - 1$):

$$A_i = \frac{r_i - \mu}{\sigma + \varepsilon}$$

With outcome rewards, every token of answer $i$ gets the same advantage $A_i$.

**k3 estimator.** For one token with log probabilities $\log \pi_\theta$ and $\log \pi_{ref}$:

$$\hat{D}_{KL} = \frac{\pi_{ref}}{\pi_\theta} - \log \frac{\pi_{ref}}{\pi_\theta} - 1$$

**Objective.** For token $t$ of answer $i$, let $\rho_{i,t} = \exp(\log \pi_\theta - \log \pi_{old})$. Then

$$J = \frac{1}{N} \sum_{i=1}^{N} \frac{1}{|o_i|} \sum_{t \in o_i} \Big[ \min\big(\rho_{i,t} A_i,\ \mathrm{clip}(\rho_{i,t}, 1 - \epsilon, 1 + \epsilon)\, A_i\big) - \beta\, \hat{D}_{KL,i,t} \Big]$$

Here $N$ is the number of answers, $o_i$ is the set of valid tokens of answer $i$ (where `mask` is `True`), and $|o_i|$ is their number. Average the tokens of each answer first. Then average the answers.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `rewards` | float array | `(num_groups, G)` | the reward of each answer, one group in each row |
| `eps` | float | | the small number added to the standard deviation |
| `logp` | float array | `(N, L)` | log probability of each sampled token under the current policy |
| `old_logp` | float array | `(N, L)` | the same under the policy that sampled the answers |
| `ref_logp` | float array | `(N, L)` | the same under the reference policy |
| `advantages` | float array | `(N,)` | one advantage for each answer |
| `mask` | bool array | `(N, L)` | `True` for a valid token, `False` for padding |
| `clip_eps` | float | | $\epsilon$, the clip range |
| `beta` | float | | the weight of the KL penalty |

- `group_advantages` returns a float array of shape `(num_groups, G)`.
- `kl_k3` returns a float array with the shape of its inputs.
- `grpo_objective` returns a Python float.

## Constraints

- `1 <= G, N <= 64` and `1 <= L <= 512`.
- Each answer has at least one valid token.
- Padding tokens can hold any finite value. They must not change the result.
- Do not change the input arrays.
- Use numpy only.

## Examples

```python
group_advantages(np.array([[1.0, 0.0, 0.0, 1.0], [0.0, 0.0, 1.0, 0.0]]))
kl_k3(np.array([-1.0, -2.0, -0.5]), np.array([-1.0, -1.5, -1.0]))
```

```text
[[ 0.99999998 -0.99999998 -0.99999998  0.99999998]
 [-0.57735026 -0.57735026  1.73205077 -0.57735026]]
[0.         0.14872127 0.10653066]
```

```python
logp = np.array([[-1.0, -0.5, -2.0], [-0.3, -1.2, 0.0]])
old_logp = np.array([[-1.1, -0.5, -1.0], [-0.6, -1.0, 0.0]])
ref_logp = np.array([[-1.2, -0.4, -1.5], [-0.4, -1.1, 0.0]])
advantages = np.array([1.0, -1.0])
mask = np.array([[True, True, True], [True, True, False]])
grpo_objective(logp, old_logp, ref_logp, advantages, mask)
grpo_objective(logp, old_logp, ref_logp, advantages, mask, clip_eps=0.2, beta=0.0)
```

```text
-0.13122323326245566
-0.1299723302889813
```
