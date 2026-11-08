Tabular Q-learning and SARSA learn a table of action values from one transition at a time. Both move $Q[s, a]$ toward a target. Q-learning uses the best next action in the target. SARSA uses the next action that the agent really takes. An epsilon-greedy policy picks the actions while the table learns.

## Task

Write three functions.

1. `q_learning_update(Q, s, a, r, s_next, done, alpha=0.1, gamma=0.99)` returns the table after one Q-learning update.
2. `sarsa_update(Q, s, a, r, s_next, a_next, done, alpha=0.1, gamma=0.99)` returns the table after one SARSA update.
3. `epsilon_greedy(Q, s, epsilon, rng)` returns the action for state `s`.

Both updates change only the entry $Q[s, a]$:

$$Q[s, a] \leftarrow Q[s, a] + \alpha \left(y - Q[s, a]\right)$$

The target $y$ for Q-learning is $r + \gamma \max_{a'} Q[s', a']$. The target for SARSA is $r + \gamma \, Q[s', a_{next}]$. When `done` is `True`, the target is $r$ only, with no term for the next state. The target uses the values of `Q` before the update.

`epsilon_greedy` uses the generator `rng` in this exact order:

1. Draw `u = rng.random()`.
2. If `u < epsilon`, draw and return `rng.integers(n_actions)`.
3. Else return the action with the largest `Q[s]`. On a tie, return the lowest index.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `Q` | float array | `(n_states, n_actions)` | the action values |
| `s`, `s_next` | int | | the state and the next state |
| `a`, `a_next` | int | | the action and the next action |
| `r` | float | | the reward of the transition |
| `done` | bool | | `True` when `s_next` is terminal |
| `alpha` | float | | the step size, from 0 to 1 |
| `gamma` | float | | the discount, from 0 to 1 |
| `epsilon` | float | | the probability of a random action, from 0 to 1 |
| `rng` | `np.random.Generator` | | the random generator |

- `q_learning_update` and `sarsa_update` return a new float array of shape `(n_states, n_actions)`.
- `epsilon_greedy` returns a Python `int`.

## Constraints

- `1 <= n_states <= 1000` and `1 <= n_actions <= 20`.
- `s_next` can be equal to `s`.
- Do not change the input table. Return a new table.
- Use numpy only.

## Examples

```python
Q = np.array([[0.0, 1.0], [2.0, -1.0], [0.5, 0.5]])
q_learning_update(Q, 0, 1, -1.0, 1, False, alpha=0.5, gamma=0.9)
sarsa_update(Q, 0, 1, -1.0, 1, 1, False, alpha=0.5, gamma=0.9)
q_learning_update(Q, 0, 1, -1.0, 1, True, alpha=0.5, gamma=0.9)
```

```text
[[ 0.   0.9]
 [ 2.  -1. ]
 [ 0.5  0.5]]
[[ 0.   -0.45]
 [ 2.   -1.  ]
 [ 0.5   0.5 ]]
[[ 0.   0. ]
 [ 2.  -1. ]
 [ 0.5  0.5]]
```

```python
rng = np.random.default_rng(7)
Q = np.array([[1.0, 3.0, 3.0, 0.0]])
[epsilon_greedy(Q, 0, 0.5, rng) for _ in range(12)]
```

```text
[1, 1, 1, 0, 1, 1, 1, 1, 3, 1, 3, 1]
```
