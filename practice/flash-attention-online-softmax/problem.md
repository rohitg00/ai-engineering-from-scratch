Standard attention builds the full matrix of scores, of size $T_q \times T_k$. FlashAttention never builds that matrix. It reads the keys and values in blocks and keeps a running softmax for each query row. The result is exact, not an approximation. Here you write that running softmax in numpy.

## Task

Write two functions.

1. `online_softmax_step(m, l, acc, scores, v_block)` adds one block of keys to the running state of each query row.
2. `flash_attention(Q, K, V, block_size, causal=False)` runs the step over the key blocks and returns the attention output and the log-sum-exp of each row.

The state of query row $i$ has three parts: the running max $m_i$, the running sum $l_i$, and the accumulator $a_i$, a vector of size $d_v$. At the start, $m_i = -\infty$, $l_i = 0$ and $a_i = 0$. For a block with scores $s_{ij}$ and value rows $v_j$, the step computes:

$$m_i' = \max(m_i, \max_j s_{ij}), \qquad c_i = e^{m_i - m_i'}$$

$$l_i' = c_i \, l_i + \sum_j e^{s_{ij} - m_i'}, \qquad a_i' = c_i \, a_i + \sum_j e^{s_{ij} - m_i'} \, v_j$$

A score of $-\infty$ is a blocked key. When $m_i'$ is $-\infty$, the row has no allowed key yet. Then use 0 in place of $m_i'$ inside both exponentials, so that $c_i = 0$ and each term is 0. The step then returns $m_i' = -\infty$, $l_i' = 0$ and $a_i' = 0$.

In `flash_attention`, the scores of a block are $Q K_b^T / \sqrt{d}$, where $K_b$ holds the key rows from `start` to `start + block_size` and $d$ is the size of the last axis of `Q`. The blocks start at 0, `block_size`, `2 * block_size` and so on. The last block can be shorter. With `causal=True`, key $j$ is blocked for query $i$ when $j > i$. The indices $i$ and $j$ are global row indices, not indices inside a block. After the last block, the output row is $a_i / l_i$ and the log-sum-exp is $m_i + \log l_i$.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `m` | float array | `(Tq,)` | the running max of each query row |
| `l` | float array | `(Tq,)` | the running sum of each query row |
| `acc` | float array | `(Tq, d_v)` | the running accumulator of each query row |
| `scores` | float array | `(Tq, b)` | the scores of one block of `b` keys, `-inf` for a blocked key |
| `v_block` | float array | `(b, d_v)` | the value rows of the same block |
| `Q` | float array | `(Tq, d)` | the queries |
| `K` | float array | `(Tk, d)` | the keys |
| `V` | float array | `(Tk, d_v)` | the values |
| `block_size` | int | | the number of keys in each block |
| `causal` | bool | | `True` blocks key `j` for query `i` when `j > i` |

- `online_softmax_step` returns a tuple `(m_new, l_new, acc_new)` with the shapes of `m`, `l` and `acc`.
- `flash_attention` returns a tuple `(output, lse)`. `output` has shape `(Tq, d_v)`. `lse` has shape `(Tq,)`.

## Constraints

- `1 <= Tq, Tk, d, d_v <= 64` and `1 <= block_size <= 128`. The block size can be larger than `Tk`.
- Process the keys block by block. Do not build the full `(Tq, Tk)` score matrix.
- Scores can be larger than 1000 in one block and smaller than minus 1000 in the next. The output must stay finite and exact.
- The result must equal standard attention for every block size, to about 1e-9.
- Do not change the input arrays.
- Use numpy only.

## Examples

```python
Q = np.array([[1.0, 0.0], [0.0, 1.0]])
K = np.array([[1.0, 0.0], [0.0, 1.0], [1.0, 1.0]])
V = np.array([[1.0, 2.0], [3.0, 4.0], [5.0, 6.0]])
output, lse = flash_attention(Q, K, V, 2)
```

```text
output
[[3.         4.        ]
 [3.40667256 4.40667256]]
lse
[1.62062114 1.62062114]
```

Block sizes 1 and 3 give the same values.

```python
output, lse = flash_attention(K, K, V, 2, causal=True)
```

```text
output
[[1.         2.        ]
 [2.3395231  3.3395231 ]
 [3.51046953 4.51046953]]
lse
[0.70710678 1.10794031 2.1004053 ]
```

```python
m = np.array([1.0, -np.inf])
l = np.array([2.0, 0.0])
acc = np.array([[1.0, 1.0], [0.0, 0.0]])
scores = np.array([[3.0, 0.0], [-np.inf, 0.5]])
v_block = np.array([[1.0, 0.0], [0.0, 1.0]])
m_new, l_new, acc_new = online_softmax_step(m, l, acc, scores, v_block)
```

```text
m_new
[3.  0.5]
l_new
[1.32045763 1.        ]
acc_new
[[1.13533528 0.18512235]
 [0.         1.        ]]
```
