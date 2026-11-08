A mixture of experts layer sends each token to a few experts out of many. A router gives one logit for each expert. The layer keeps the top k experts and mixes their outputs with gate weights. The Switch Transformer paper adds an auxiliary loss so that the router spreads the tokens over all experts.

## Task

Write two functions.

1. `route(logits, top_k)` returns the chosen experts and their gates for each token.
2. `load_balancing_loss(logits, top_k)` returns the auxiliary load-balancing loss as a float.

**Routing.** For each token, sort the experts by logit, largest first. Keep the first $k$ experts. When two logits are equal, the expert with the lower index comes first. The gates are a softmax over the $k$ chosen logits only:

$$g_{t,j} = \frac{\exp(z_{t,j})}{\sum_{i \in \text{top-}k(t)} \exp(z_{t,i})}$$

This is the same as the full softmax over all $E$ experts, renormalized over the $k$ chosen experts. The gates of a token sum to 1. Column $j$ of the gates belongs to the expert in column $j$ of `top_idx`.

**Load-balancing loss.** Let $T$ be the number of tokens and $E$ the number of experts.

- $f_i$ is the fraction of the $T k$ assignments that go to expert $i$: the number of tokens that have $i$ in their top $k$, divided by $T k$.
- $P_i = \frac{1}{T} \sum_t p_{t,i}$, where $p_t$ is the full softmax of the logits of token $t$ over all $E$ experts.
- The loss is $\mathcal{L} = E \sum_{i=1}^{E} f_i P_i$.

With $k = 1$ this is the loss of the paper. The loss is 1 when the router is uniform. It grows toward $E$ when all tokens go to one expert.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `logits` | float array | `(T, E)` | the router logit of each token for each expert |
| `top_k` | int | | the number of experts for each token |

- `route` returns a tuple `(top_idx, gates)`.
- `top_idx` is an int array of shape `(T, top_k)`. Row `t` holds the chosen expert indices, largest logit first.
- `gates` is a float array of shape `(T, top_k)`.
- `load_balancing_loss` returns a Python float.

## Constraints

- `1 <= T <= 256`, `1 <= E <= 64` and `1 <= top_k <= E`.
- Logits can have an absolute value of 1000. The gates must stay finite.
- $f_i$ comes from counts. Do not use the probabilities for $f_i$.
- Do not change the input array.
- Use numpy only.

## Examples

```python
logits = np.array([[2.0, 1.0, 0.5, -1.0], [0.0, 3.0, 3.0, 1.0], [1.0, 1.0, 1.0, 1.0]])
top_idx, gates = route(logits, 2)
```

```text
top_idx
[[0 1]
 [1 2]
 [0 1]]
gates
[[0.73105858 0.26894142]
 [0.5        0.5       ]
 [0.5        0.5       ]]
```

```python
load_balancing_loss(logits, 2)
load_balancing_loss(logits, 1)
load_balancing_loss(np.zeros((5, 4)), 2)
```

```text
1.2008139315343698
1.1983721362825372
1.0
```
