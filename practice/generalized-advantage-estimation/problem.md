An actor critic needs an advantage for each step: how much better the action was than the critic expected. Generalized advantage estimation (GAE) mixes the one-step TD error with longer returns. The parameter $\lambda$ controls the mix. A2C and PPO use GAE on every rollout.

## Task

Write two functions.

1. `td_errors(rewards, values, dones, gamma)` returns the TD error of each step: $\delta_t = r_t + \gamma (1 - d_t) V_{t+1} - V_t$.
2. `gae(rewards, values, dones, gamma, lam)` returns a tuple `(advantages, returns)`.

The advantages follow the recursion from the last step to the first step:

$A_{T-1} = \delta_{T-1}$ and $A_t = \delta_t + \gamma \lambda (1 - d_t) A_{t+1}$ for $t < T - 1$.

The returns are the targets for the critic: $R_t = A_t + V_t$.

Here $d_t$ is 1 when `dones[t]` is `True` and 0 otherwise. A done flag at step $t$ means that step $t$ is the last step of its episode. The next value and the next advantage are then 0.

The array `values` has $T + 1$ entries. `values[t]` is the critic value of the state at step $t$. `values[T]` is the bootstrap value: the critic value of the state after the last step. It is used only when the last step has no done flag.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `rewards` | float array | `(T,)` | the reward at each step |
| `values` | float array | `(T + 1,)` | the critic value of each state, then the bootstrap value |
| `dones` | bool array | `(T,)` | `True` at the last step of each episode |
| `gamma` | float | scalar | the discount factor, from 0 to 1 |
| `lam` | float | scalar | the GAE parameter $\lambda$, from 0 to 1 |

- `td_errors` returns a float array of shape `(T,)`.
- `gae` returns a tuple of two float arrays, each of shape `(T,)`: the advantages, then the returns.

## Constraints

- `1 <= T <= 1000`.
- Do not normalize the advantages. Normalization is a separate step.
- Do not change the input arrays.
- Use numpy only.

## Examples

```python
rewards = np.array([1.0, 0.0, 1.0])
values = np.array([0.5, 0.4, 0.3, 0.2])
dones = np.array([False, False, True])
td_errors(rewards, values, dones, 0.9)
```

```text
[ 0.86 -0.13  0.7 ]
```

```python
gae(rewards, values, dones, 0.9, 0.8)
```

```text
(array([1.12928, 0.374  , 0.7    ]), array([1.62928, 0.774  , 1.     ]))
```

```python
rewards = np.array([1.0, 1.0, 1.0, 1.0])
values = np.array([1.0, 2.0, 1.0, 2.0, 3.0])
dones = np.array([False, True, False, False])
gae(rewards, values, dones, 0.5, 0.5)
```

```text
(array([ 0.75 , -1.   ,  1.125,  0.5  ]), array([1.75 , 1.   , 2.125, 2.5  ]))
```
