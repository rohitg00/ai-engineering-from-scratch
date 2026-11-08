Attention lets each query token collect information from a set of key and value tokens. Every transformer layer in the course uses this operation. A decoder adds a causal mask, so that a token cannot see the tokens that come after it.

## Task

Write two functions.

1. `causal_mask(T)` returns the causal mask for a sequence of `T` tokens.
2. `scaled_dot_product_attention(Q, K, V, mask=None)` returns the attention output and the attention weights.

The scores are $S = Q K^T / \sqrt{d_k}$, where $d_k$ is the size of the last axis of `Q`. The weights are the softmax of each row of $S$, over the key axis. The output is the weights times `V`.

The mask is a boolean array. **`True` means blocked.** A blocked query and key pair gets a weight of exactly 0. The other weights in the row are a softmax over the allowed keys only, so each row of weights sums to 1.

The causal mask has `True` at row `i` and column `j` when `j > i`. Token `i` can see token `i` and every token before it.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `T` | int | | the number of tokens |
| `Q` | float array | `(..., Tq, d_k)` | the queries, with zero or more leading batch axes |
| `K` | float array | `(..., Tk, d_k)` | the keys, with the same leading axes as `Q` |
| `V` | float array | `(..., Tk, d_v)` | the values, with the same leading axes as `Q` |
| `mask` | bool array or `None` | broadcasts to `(..., Tq, Tk)` | `True` blocks a query and key pair |

- `causal_mask` returns a bool array of shape `(T, T)`.
- `scaled_dot_product_attention` returns a tuple `(output, weights)`.
- `output` is a float array of shape `(..., Tq, d_v)`.
- `weights` is a float array of shape `(..., Tq, Tk)`.

## Constraints

- `1 <= T, Tq, Tk <= 64` and `1 <= d_k, d_v <= 64`.
- Each row of the mask has at least one allowed key.
- Scores can be larger than 1000. The output must stay finite.
- Transpose only the last two axes of `K`. The leading axes are batch axes.
- Do not change the input arrays.
- Use numpy only.

## Examples

```python
Q = np.array([[1.0, 0.0], [0.0, 1.0]])
K = np.array([[1.0, 0.0], [0.0, 1.0], [1.0, 1.0]])
V = np.array([[1.0, 2.0], [3.0, 4.0], [5.0, 6.0]])
output, weights = scaled_dot_product_attention(Q, K, V)
```

```text
output
[[3.         4.        ]
 [3.40667256 4.40667256]]
weights
[[0.40111209 0.19777581 0.40111209]
 [0.19777581 0.40111209 0.40111209]]
```

```python
causal_mask(3)
```

```text
[[False  True  True]
 [False False  True]
 [False False False]]
```

```python
X = np.array([[1.0, 0.0], [0.0, 1.0], [1.0, 1.0]])
output, weights = scaled_dot_product_attention(X, X, V, mask=causal_mask(3))
```

```text
output
[[1.         2.        ]
 [2.3395231  3.3395231 ]
 [3.51046953 4.51046953]]
weights
[[1.         0.         0.        ]
 [0.33023845 0.66976155 0.        ]
 [0.24825508 0.24825508 0.50348984]]
```
