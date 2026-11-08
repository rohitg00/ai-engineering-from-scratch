Grouped-query attention (GQA) lets several query heads share one key head and one value head. The model then stores fewer keys and values in its cache. With one group, GQA is multi-query attention. With one group for each query head, GQA is standard multi-head attention. Large open models such as Llama 3 use GQA.

## Task

Write three functions.

1. `repeat_kv(kv, n_heads)` repeats each key or value head so that every query head has a matching head.
2. `grouped_query_attention(x, w_q, w_k, w_v, w_o, n_heads, n_kv_heads)` returns the output and the attention weights of GQA self-attention.
3. `mean_pool_kv_heads(w, n_heads, n_kv_heads)` turns the key or value projection of a multi-head checkpoint into a GQA projection.

Let $H$ be `n_heads`, $G$ be `n_kv_heads`, $r = H / G$ and $d_{head} = D / H$. Head $h$ of a projected array holds the columns $h \cdot d_{head}$ to $(h + 1) \cdot d_{head} - 1$, in the same order. **Query head $h$ uses key and value group $\lfloor h / r \rfloor$.** So the first $r$ query heads use group 0, the next $r$ use group 1, and so on.

The steps of `grouped_query_attention` are:

1. $Q = x W_q$, $K = x W_k$, $V = x W_v$. There are no bias terms.
2. Split $Q$ into $H$ heads and split $K$ and $V$ into $G$ heads each. Repeat $K$ and $V$ to $H$ heads.
3. In each head, compute $\mathrm{softmax}(Q_h K_h^T / \sqrt{d_{head}})\, V_h$. The softmax is over the key axis. There is no mask.
4. Join the $H$ head outputs in head order, so that the result has shape `(B, T, D)`, and multiply by $W_o$.

`mean_pool_kv_heads` takes a projection with $H$ heads. Group $g$ of the result is the mean of the heads $g r$ to $g r + r - 1$.

All three functions raise `ValueError` when $H$ is not a multiple of $G$.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `kv` | float array | `(B, G, T, d_head)` | keys or values split into `G` heads |
| `x` | float array | `(B, T, D)` | a batch of `B` sequences of `T` tokens with `D` features |
| `w_q` | float array | `(D, D)` | the query projection |
| `w_k`, `w_v` | float array | `(D, G * d_head)` | the key and value projections |
| `w_o` | float array | `(D, D)` | the output projection |
| `n_heads` | int | | the number of query heads `H` |
| `n_kv_heads` | int | | the number of key and value groups `G` |
| `w` | float array | `(D, H * d_head)` | a key or value projection with `H` heads |

- `repeat_kv` returns a float array of shape `(B, H, T, d_head)`.
- `grouped_query_attention` returns a tuple `(output, weights)`. `output` has shape `(B, T, D)`. `weights` has shape `(B, H, T, T)`, and `weights[b, h, i, j]` is the weight that query `i` gives to key `j` in head `h`.
- `mean_pool_kv_heads` returns a float array of shape `(D, G * d_head)`.

## Constraints

- `1 <= B <= 4`, `1 <= T <= 32`, `1 <= G <= H <= 16` and `D` is a multiple of `H`.
- Divide the scores by $\sqrt{d_{head}}$, not by $\sqrt{D}$.
- Do not change the input arrays.
- Use numpy only.

## Examples

```python
kv = np.arange(8.0).reshape(1, 2, 2, 2)
repeat_kv(kv, 4)[0]
```

```text
[[[0. 1.]
  [2. 3.]]

 [[0. 1.]
  [2. 3.]]

 [[4. 5.]
  [6. 7.]]

 [[4. 5.]
  [6. 7.]]]
```

```python
x = np.array([[[1.0, 0.0, 0.0, 1.0], [0.0, 1.0, 1.0, 0.0], [1.0, 1.0, 0.0, 0.0]]])
w_k = np.array([[1.0, 0.0], [0.0, 1.0], [0.0, 0.0], [0.0, 0.0]])
w_v = np.array([[1.0, 0.0], [0.0, 2.0], [0.0, 0.0], [1.0, 0.0]])
output, weights = grouped_query_attention(x, np.eye(4), w_k, w_v, np.eye(4), 2, 1)
```

```text
output
[[[1.20333628 1.19777581 0.79666372 1.60444837]
  [0.79666372 1.60444837 1.20333628 1.19777581]
  [1.         1.50348984 1.         1.33333333]]]
weights
[[[[0.40111209 0.19777581 0.40111209]
   [0.19777581 0.40111209 0.40111209]
   [0.24825508 0.24825508 0.50348984]]

  [[0.19777581 0.40111209 0.40111209]
   [0.40111209 0.19777581 0.40111209]
   [0.33333333 0.33333333 0.33333333]]]]
```

```python
mean_pool_kv_heads(np.arange(16.0).reshape(2, 8), 4, 2)
```

```text
[[ 1.  2.  5.  6.]
 [ 9. 10. 13. 14.]]
```
