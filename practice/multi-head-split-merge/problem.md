Multi-head attention runs several small attentions in parallel. Each head sees one slice of the features. The heads are then joined again and mixed by an output projection. The hard part is the reshape: a wrong axis order gives the right shape but the wrong numbers.

## Task

Write three functions.

1. `split_heads(x, n_heads)` turns `x` of shape `(B, T, D)` into an array of shape `(B, H, T, d_head)`, with `H = n_heads` and `d_head = D / H`. Head `h` holds the columns `h * d_head` to `(h + 1) * d_head - 1` of `x`, in the same order. So `split_heads(x, H)[b, h, t, j]` equals `x[b, t, h * d_head + j]`.
2. `merge_heads(x)` is the inverse. It turns `(B, H, T, d_head)` into `(B, T, H * d_head)`, so that `merge_heads(split_heads(x, H))` equals `x`.
3. `multi_head_attention(x, w_q, w_k, w_v, w_o, n_heads)` returns the output and the attention weights of multi-head self-attention.

The steps of `multi_head_attention` are:

1. $Q = x W_q$, $K = x W_k$, $V = x W_v$. There are no bias terms.
2. Split $Q$, $K$ and $V$ into heads.
3. In each head, compute $\mathrm{softmax}(Q_h K_h^T / \sqrt{d_{head}})\, V_h$. The softmax is over the key axis. There is no mask.
4. Merge the head outputs and multiply by $W_o$.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `x` | float array | `(B, T, D)` | a batch of `B` sequences of `T` tokens with `D` features |
| `n_heads` | int | | the number of heads `H` |
| `w_q`, `w_k`, `w_v` | float array | `(D, D)` | the query, key and value projections |
| `w_o` | float array | `(D, D)` | the output projection |

- `split_heads` returns a float array of shape `(B, H, T, D / H)`.
- `merge_heads` takes an array of shape `(B, H, T, d_head)` and returns a float array of shape `(B, T, H * d_head)`.
- `multi_head_attention` returns a tuple `(output, weights)`. `output` has shape `(B, T, D)`. `weights` has shape `(B, H, T, T)`, and `weights[b, h, i, j]` is the weight that query `i` gives to key `j` in head `h`.

## Constraints

- `1 <= B, T <= 16` and `1 <= H <= D <= 64`.
- When `D` is not divisible by `n_heads`, `split_heads` raises `ValueError`.
- Activations can be large. The output must stay finite.
- Do not change the input arrays.
- Use numpy only.

## Examples

```python
x = np.arange(8.0).reshape(1, 2, 4)
split_heads(x, 2)
```

```text
[[[[0. 1.]
   [4. 5.]]

  [[2. 3.]
   [6. 7.]]]]
```

`merge_heads` of that result gives `x` again.

```python
x = np.array([[[1.0, 0.0, 0.0, 1.0], [0.0, 2.0, 1.0, 0.0], [1.0, 1.0, 1.0, 1.0]]])
eye = np.eye(4)
output, weights = multi_head_attention(x, eye, eye, eye, eye, 2)
```

```text
output
[[[0.80222419 0.79666372 0.59888791 0.80222419]
  [0.23208206 1.72252957 0.80222419 0.59888791]
  [0.59888791 1.20333628 0.75174492 0.75174492]]]
weights
[[[[0.40111209 0.19777581 0.40111209]
   [0.04538836 0.76791794 0.1866937 ]
   [0.19777581 0.40111209 0.40111209]]

  [[0.40111209 0.19777581 0.40111209]
   [0.19777581 0.40111209 0.40111209]
   [0.24825508 0.24825508 0.50348984]]]]
```
