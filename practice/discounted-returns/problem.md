REINFORCE scales the gradient of each action by the return that follows it. This return is the reward to go: the discounted sum of the rewards from that step to the end of the episode. A rollout buffer often holds several episodes in one array, with a done flag at the last step of each episode.

## Task

Write three functions.

1. `returns_to_go(rewards, gamma)` returns the reward to go of one episode. For an episode of length $T$, $G_{T-1} = r_{T-1}$ and $G_t = r_t + \gamma G_{t+1}$ for $t < T - 1$.
2. `batch_returns(rewards, dones, gamma)` returns the reward to go for a batch of episodes that are joined in one array. When `dones[t]` is `True`, step $t$ is the last step of its episode, so $G_t = r_t$. Otherwise $G_t = r_t + \gamma G_{t+1}$. The last step of the batch has no next step. Use $G_{t+1} = 0$ there, also when its done flag is `False`.
3. `normalize(returns)` returns $(G - \mu) / (\sigma + 10^{-8})$. Here $\mu$ is the mean and $\sigma$ is the population standard deviation (`ddof = 0`). When the array has fewer than 2 values, return a copy of the values unchanged.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `rewards` | float array | `(T,)` | the reward at each step |
| `dones` | bool array | `(T,)` | `True` at the last step of each episode |
| `gamma` | float | scalar | the discount factor, from 0 to 1 |
| `returns` | float array | `(T,)` | returns to normalize |

Each function returns a float array of shape `(T,)`.

## Constraints

- `1 <= T <= 1000` and `0 <= gamma <= 1`.
- Do not change the input arrays.
- Use numpy only.

## Examples

```python
returns_to_go(np.array([1.0, 0.0, 2.0]), 0.9)
```

```text
[2.62 1.8  2.  ]
```

```python
rewards = np.array([1.0, 1.0, 1.0, 1.0, 1.0])
dones = np.array([False, True, False, False, True])
batch_returns(rewards, dones, 0.5)
```

```text
[1.5  1.   1.75 1.5  1.  ]
```

```python
normalize(np.array([1.0, 2.0, 3.0, 4.0]))
```

```text
[-1.34164077 -0.44721359  0.44721359  1.34164077]
```
